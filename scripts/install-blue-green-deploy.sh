#!/usr/bin/env bash
set -euo pipefail

test_root="${SYNTHARENA_TEST_ROOT:-}"
if [ -n "$test_root" ]; then
    case "$test_root" in
        /*) ;;
        *)
            echo "SYNTHARENA_TEST_ROOT must be an absolute path" >&2
            exit 1
            ;;
    esac
    test_root="$(readlink -f "$test_root")"
    if [ "$test_root" = / ]; then
        echo "SYNTHARENA_TEST_ROOT must not resolve to /" >&2
        exit 1
    fi
fi

if [ "$EUID" -ne 0 ] && [ -z "$test_root" ]; then
    echo "install-blue-green-deploy.sh must run as root" >&2
    exit 1
fi

system_path() {
    printf '%s%s\n' "${test_root%/}" "$1"
}

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
site_link="${SYNTHARENA_NGINX_SITE:-$(system_path /etc/nginx/sites-enabled/syntharena)}"
switch_source="${repo_root}/deployment/nginx/syntharena-switch-upstream"
switch_target="$(system_path /usr/local/sbin/syntharena-switch-upstream)"
config_dir="$(system_path /etc/nginx/syntharena-upstreams)"
active_link="$(system_path /etc/nginx/conf.d/syntharena-upstream.conf)"
shutdown_config="$(system_path /etc/nginx/modules-enabled/99-syntharena-worker-shutdown.conf)"
sudoers_file="$(system_path /etc/sudoers.d/syntharena-blue-green-deploy)"
ready_dir="$(system_path /var/lib/syntharena-deploy)"
ready_marker="${ready_dir}/blue-green-ready"
deployment_user="${SYNTHARENA_DEPLOY_USER:-$(stat -c '%U' "$repo_root")}"
install_owner_args=(-o root -g root)
if [ "$EUID" -ne 0 ]; then
    install_owner_args=()
fi

for command in curl nginx systemctl visudo; do
    if ! command -v "$command" >/dev/null 2>&1; then
        echo "required command is unavailable: $command" >&2
        exit 1
    fi
done

if [ ! -L "$site_link" ] && [ ! -f "$site_link" ]; then
    echo "missing SynthArena Nginx site: $site_link" >&2
    exit 1
fi

if [ ! -f "$switch_source" ]; then
    echo "missing upstream switch helper: $switch_source" >&2
    exit 1
fi

site_path="$(readlink -f "$site_link")"
if [ -L "$active_link" ]; then
    active_target="$(readlink -f "$active_link" 2>/dev/null || true)"
    case "$active_target" in
        "$config_dir/legacy.conf" | "$config_dir/blue.conf" | "$config_dir/green.conf") ;;
        *)
            echo "refusing to replace an unknown SynthArena upstream link: $active_link" >&2
            exit 1
            ;;
    esac
elif [ -e "$active_link" ]; then
    echo "refusing to replace a non-symlink SynthArena upstream file: $active_link" >&2
    exit 1
fi

ready_dir_existed=false
[ -d "$ready_dir" ] && ready_dir_existed=true

state_backup_dir="$(mktemp -d)"
sudoers_temp="$(mktemp)"
site_backup="${state_backup_dir}/site"
cp -a "$site_path" "$site_backup"

backup_path() {
    local source_path="$1"
    local backup_path="$2"

    if [ -e "$source_path" ] || [ -L "$source_path" ]; then
        cp -a "$source_path" "$backup_path"
    fi
}

restore_file() {
    local target_path="$1"
    local backup_path="$2"

    rm -f "$target_path"
    if [ -e "$backup_path" ] || [ -L "$backup_path" ]; then
        cp -a "$backup_path" "$target_path"
    fi
}

restore_directory() {
    local target_path="$1"
    local backup_path="$2"

    rm -rf "$target_path"
    if [ -d "$backup_path" ]; then
        cp -a "$backup_path" "$target_path"
    fi
}

backup_path "$config_dir" "${state_backup_dir}/config-dir"
backup_path "$active_link" "${state_backup_dir}/active-link"
backup_path "$shutdown_config" "${state_backup_dir}/shutdown-config"
backup_path "$switch_target" "${state_backup_dir}/switch-target"
backup_path "$sudoers_file" "${state_backup_dir}/sudoers-file"
backup_path "$ready_marker" "${state_backup_dir}/ready-marker"

finish() {
    local exit_code=$?

    trap - EXIT
    if [ "$exit_code" -ne 0 ]; then
        cp -a "$site_backup" "$site_path"
        restore_directory "$config_dir" "${state_backup_dir}/config-dir"
        restore_file "$active_link" "${state_backup_dir}/active-link"
        restore_file "$shutdown_config" "${state_backup_dir}/shutdown-config"
        restore_file "$switch_target" "${state_backup_dir}/switch-target"
        restore_file "$sudoers_file" "${state_backup_dir}/sudoers-file"
        rm -f "$ready_marker"

        if nginx -t && systemctl reload nginx; then
            restore_file "$ready_marker" "${state_backup_dir}/ready-marker"
        else
            echo "could not reload the restored Nginx configuration; deployment remains disabled" >&2
        fi
        if [ "$ready_dir_existed" = false ]; then
            rmdir "$ready_dir" 2>/dev/null || true
        fi
    fi
    rm -rf "$state_backup_dir"
    rm -f "$sudoers_temp"
    exit "$exit_code"
}
trap finish EXIT

# Do not publish a ready marker until every replacement has validated.
rm -f "$ready_marker"

legacy_proxy_pattern='^[[:space:]]*proxy_pass[[:space:]]+http://(localhost|127\.0\.0\.1):1000;[[:space:]]*(#.*)?$'
upstream_proxy_pattern='^[[:space:]]*proxy_pass[[:space:]]+http://syntharena_app;[[:space:]]*(#.*)?$'
legacy_proxy_count="$(grep -Ec "$legacy_proxy_pattern" "$site_path" || true)"
upstream_proxy_count="$(grep -Ec "$upstream_proxy_pattern" "$site_path" || true)"

if [ "$upstream_proxy_count" -gt 0 ]; then
    if [ "$upstream_proxy_count" -ne 1 ] || [ "$legacy_proxy_count" -ne 0 ]; then
        echo "SynthArena's Nginx proxy_pass is ambiguous; expected exactly one upstream form" >&2
        exit 1
    fi
else
    if [ "$legacy_proxy_count" -ne 1 ]; then
        echo "SynthArena's Nginx proxy_pass must contain exactly one expected legacy configuration" >&2
        exit 1
    fi

    if ! curl --fail --silent --show-error --connect-timeout 5 --max-time 15 \
        http://127.0.0.1:1000/api/health >/dev/null; then
        echo "the legacy app on port 1000 must be healthy before installing blue/green routing" >&2
        exit 1
    fi

    sed -E -i \
        's#^([[:space:]]*proxy_pass[[:space:]]+)http://(localhost|127\.0\.0\.1):1000;(.*)$#\1http://syntharena_app;\3#' \
        "$site_path"
fi

install -d -m 755 "${install_owner_args[@]}" "$config_dir"
for slot_and_port in 'legacy 1000' 'blue 1001' 'green 1002'; do
    read -r slot port <<<"$slot_and_port"
    printf 'upstream syntharena_app {\n    server 127.0.0.1:%s;\n    keepalive 32;\n}\n' "$port" \
        >"${config_dir}/${slot}.conf"
    chmod 644 "${config_dir}/${slot}.conf"
done

if [ ! -L "$active_link" ]; then
    ln -s "${config_dir}/legacy.conf" "$active_link"
fi

printf 'worker_shutdown_timeout 30s;\n' >"$shutdown_config"
chmod 644 "$shutdown_config"
install -m 755 "${install_owner_args[@]}" "$switch_source" "$switch_target"

if [ "$deployment_user" != root ]; then
    printf '%s ALL=(root) NOPASSWD: %s current\n' "$deployment_user" "$switch_target" >"$sudoers_temp"
    for slot in legacy blue green; do
        printf '%s ALL=(root) NOPASSWD: %s %s\n' "$deployment_user" "$switch_target" "$slot" \
            >>"$sudoers_temp"
    done
    if ! visudo -cf "$sudoers_temp"; then
        echo "blue/green sudoers configuration is invalid" >&2
        exit 1
    fi
    install -m 440 "${install_owner_args[@]}" "$sudoers_temp" "$sudoers_file"
else
    rm -f "$sudoers_file"
fi

if ! nginx -t; then
    echo "blue/green Nginx configuration is invalid; restored the previous site" >&2
    exit 1
fi

systemctl reload nginx
install -d -m 755 "${install_owner_args[@]}" "$ready_dir"
install -m 644 "${install_owner_args[@]}" /dev/null "$ready_marker"
printf 'SynthArena blue/green routing is installed; active slot: '
"$switch_target" current
