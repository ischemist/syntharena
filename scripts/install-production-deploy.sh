#!/usr/bin/env bash
set -Eeuo pipefail

test_root="${SYNTHARENA_TEST_ROOT:-}"
if [ "$EUID" -ne 0 ] && [ -z "$test_root" ]; then
    echo "install-production-deploy.sh must run as root" >&2
    exit 1
fi

public_key_path="${1:-}"
if [ ! -f "$public_key_path" ]; then
    echo "usage: install-production-deploy.sh <dedicated-ci-public-key>" >&2
    exit 1
fi

system_path() {
    printf '%s%s\n' "${test_root%/}" "$1"
}

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source_root="$(cd "${script_dir}/.." && pwd)"
config_root="${SYNTHARENA_CONFIG_ROOT:-$(system_path /var/www/syntharena)}"
app_root="${config_root}/app"
wrapper_target="$(system_path /usr/local/sbin/syntharena-deploy-command)"
authorized_keys="${SYNTHARENA_AUTHORIZED_KEYS:-$(system_path /root/.ssh/authorized_keys)}"
expected_origin='https://github.com/ischemist/syntharena.git'
install_owner_args=(-o root -g root)
[ "$EUID" -ne 0 ] && install_owner_args=()

for required in "${config_root}/.env" "${config_root}/production_data"; do
    if [ ! -e "$required" ]; then
        echo "required production path is missing: $required" >&2
        exit 1
    fi
done

if ! ssh-keygen -lf "$public_key_path" >/dev/null 2>&1; then
    echo "deployment public key is not a valid SSH key" >&2
    exit 1
fi
read -r key_type key_blob key_comment <"$public_key_path"
if [ "$key_type" != ssh-ed25519 ] || [[ ! "$key_blob" =~ ^[A-Za-z0-9+/]+={0,3}$ ]]; then
    echo "deployment key must be a dedicated unattended ssh-ed25519 public key" >&2
    exit 1
fi

deployment_sha="$(git -C "$source_root" rev-parse HEAD)"
if [ -n "$(git -C "$source_root" status --porcelain --untracked-files=no)" ]; then
    echo "bootstrap source checkout has tracked changes" >&2
    exit 1
fi
if [[ ! "$deployment_sha" =~ ^[0-9a-f]{40}$ ]] || \
    [ "$(git -C "$source_root" show "${deployment_sha}:deployment/contract-version" 2>/dev/null || true)" != '2' ]; then
    echo "bootstrap source does not support deployment contract 2" >&2
    exit 1
fi

state_dir="$(mktemp -d)"
new_app="${config_root}/.app.bootstrap.$$"
old_app="${config_root}/.app.previous.$$"
wrapper_existed=false
keys_existed=false
app_promoted=false
[ -e "$wrapper_target" ] && { cp -a "$wrapper_target" "${state_dir}/wrapper"; wrapper_existed=true; }
[ -e "$authorized_keys" ] && { cp -a "$authorized_keys" "${state_dir}/authorized_keys"; keys_existed=true; }

finish() {
    local exit_code=$?
    trap - EXIT
    if [ "$exit_code" -ne 0 ]; then
        rm -rf "$new_app"
        if [ "$app_promoted" = true ]; then rm -rf "$app_root"; fi
        if [ -e "$old_app" ]; then
            mv "$old_app" "$app_root"
        fi
        if [ "$wrapper_existed" = true ]; then cp -a "${state_dir}/wrapper" "$wrapper_target"; else rm -f "$wrapper_target"; fi
        if [ "$keys_existed" = true ]; then cp -a "${state_dir}/authorized_keys" "$authorized_keys"; else rm -f "$authorized_keys"; fi
    else
        rm -rf "$old_app"
    fi
    rm -rf "$state_dir"
    exit "$exit_code"
}
trap finish EXIT

git clone --no-checkout "$expected_origin" "$new_app"
git -C "$new_app" fetch --no-tags origin master
if ! git -C "$new_app" merge-base --is-ancestor "$deployment_sha" origin/master; then
    echo "bootstrap revision is not part of public master history" >&2
    exit 1
fi
git -C "$new_app" checkout --detach "$deployment_sha"
wrapper_source="${new_app}/deployment/ssh/syntharena-deploy-command"
if [ ! -f "$wrapper_source" ]; then
    echo "validated checkout is missing the forced-command wrapper" >&2
    exit 1
fi
ln -s ../.env "${new_app}/.env"

if [ -e "$app_root" ]; then mv "$app_root" "$old_app"; fi
mv "$new_app" "$app_root"
app_promoted=true
wrapper_source="${app_root}/deployment/ssh/syntharena-deploy-command"

install -d -m 755 "${install_owner_args[@]}" "$(dirname "$wrapper_target")"
install -m 755 "${install_owner_args[@]}" "$wrapper_source" "$wrapper_target"
install -d -m 700 "${install_owner_args[@]}" "$(dirname "$authorized_keys")"
touch "$authorized_keys"
chmod 600 "$authorized_keys"

forced_line="restrict,command=\"${wrapper_target}\" ${key_type} ${key_blob} ${key_comment:-syntharena-ci-deploy}"
keys_temp="${state_dir}/authorized_keys.new"
grep -Fv "$key_blob" "$authorized_keys" >"$keys_temp" || true
printf '%s\n' "$forced_line" >>"$keys_temp"
install -m 600 "${install_owner_args[@]}" "$keys_temp" "$authorized_keys"

echo "SynthArena deployment checkout and restricted CI key installed for ${deployment_sha}"
