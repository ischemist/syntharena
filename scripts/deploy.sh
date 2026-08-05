#!/usr/bin/env bash
set -Eeuo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "scripts/deploy.sh must run inside the git checkout" >&2
    exit 1
fi

deployment_sha="${1:-}"
image_digest="${2:-}"
if [[ ! "$deployment_sha" =~ ^[0-9a-f]{40}$ ]] || [[ ! "$image_digest" =~ ^sha256:[0-9a-f]{64}$ ]]; then
    echo "usage: scripts/deploy.sh <40-character git sha> <sha256:image-digest>" >&2
    exit 1
fi

checkout_sha="$(git rev-parse HEAD)"
if [ "$checkout_sha" != "$deployment_sha" ]; then
    echo "checkout is $checkout_sha, not requested deployment $deployment_sha" >&2
    exit 1
fi

if [ "$(cat deployment/contract-version 2>/dev/null || true)" != '2' ]; then
    echo "deployment revision does not support CI deployment contract 2" >&2
    exit 1
fi

repo_root="$(git rev-parse --show-toplevel)"
compose_file="${repo_root}/docker-compose.yml"
database_contract_path="${repo_root}/deployment/database-contract.json"
if [ ! -f "$database_contract_path" ]; then
    echo "deployment revision is missing its database identity contract" >&2
    exit 1
fi

unset COMPOSE_FILE COMPOSE_PATH_SEPARATOR COMPOSE_PROFILES COMPOSE_PROJECT_NAME
unset COMPOSE_ENV_FILES COMPOSE_DISABLE_ENV_FILE COMPOSE_IGNORE_ORPHANS COMPOSE_REMOVE_ORPHANS
export APP_BIND_HOST='127.0.0.1'
export SYNTHARENA_APP_IMAGE="ghcr.io/ischemist/syntharena@${image_digest}"

compose_project_name='syntharena'
compose() {
    docker compose \
        --project-name "$compose_project_name" \
        --project-directory "$repo_root" \
        --env-file "${repo_root}/.env" \
        -f "$compose_file" \
        "$@"
}

lock_file="${SYNTHARENA_DEPLOY_LOCK_FILE:-${repo_root}/.syntharena-deploy.lock}"
if ! command -v flock >/dev/null 2>&1; then
    echo "required command is unavailable: flock" >&2
    exit 1
fi
lock_fd="${SYNTHARENA_DEPLOY_LOCK_FD:-9}"
if [[ ! "$lock_fd" =~ ^[0-9]+$ ]]; then
    echo "SYNTHARENA_DEPLOY_LOCK_FD must be a numeric file descriptor" >&2
    exit 1
fi
if [ -z "${SYNTHARENA_DEPLOY_LOCK_FD:-}" ]; then
    exec 9>"$lock_file"
fi
if ! flock -n "$lock_fd"; then
    echo "another SynthArena deployment holds ${lock_file}" >&2
    exit 1
fi

switch_upstream_bin="${SYNTHARENA_SWITCH_UPSTREAM_BIN:-/usr/local/sbin/syntharena-switch-upstream}"
public_url="${SYNTHARENA_PUBLIC_URL:-https://syntharena.ischemist.com}"
drain_seconds="${SYNTHARENA_DRAIN_SECONDS:-35}"
curl_connect_timeout="${SYNTHARENA_CURL_CONNECT_TIMEOUT:-5}"
curl_max_time="${SYNTHARENA_CURL_MAX_TIME:-15}"

if [[ ! "$drain_seconds" =~ ^[0-9]+$ ]] || \
    [[ ! "$curl_connect_timeout" =~ ^[1-9][0-9]*$ ]] || \
    [[ ! "$curl_max_time" =~ ^[1-9][0-9]*$ ]]; then
    echo "drain must be non-negative and curl timeouts must be positive integers" >&2
    exit 1
fi

app_service_for_slot() {
    case "$1" in
        blue | green) printf 'app-%s\n' "$1" ;;
        *) return 1 ;;
    esac
}

app_port_for_slot() {
    case "$1" in
        legacy) printf '1000\n' ;;
        blue) printf '1001\n' ;;
        green) printf '1002\n' ;;
        *) return 1 ;;
    esac
}

next_app_slot() {
    case "$1" in
        legacy | green) printf 'blue\n' ;;
        blue) printf 'green\n' ;;
        *) return 1 ;;
    esac
}

switch_upstream() {
    if [ "$EUID" -eq 0 ]; then
        "$switch_upstream_bin" "$1"
    else
        sudo -n "$switch_upstream_bin" "$1"
    fi
}

check_health() {
    local url="$1"
    local retries="$2"

    curl --fail --silent --show-error \
        --connect-timeout "$curl_connect_timeout" --max-time "$curl_max_time" \
        --retry "$retries" --retry-all-errors --retry-delay 2 \
        "$url" >/dev/null
}

check_deployment_contract() {
    local url="$1"
    local attempts="$2"
    local response=''

    for ((attempt = 1; attempt <= attempts; attempt++)); do
        response="$(curl --fail --silent --show-error \
            --connect-timeout "$curl_connect_timeout" --max-time "$curl_max_time" \
            "${url}/api/deployment" 2>/dev/null || true)"
        if [[ "$response" == *"\"deploymentId\":\"${deployment_sha}\""* ]] && \
            [[ "$response" == *"\"databaseSchemaVersion\":${database_schema_version}"* ]] && \
            [[ "$response" == *"\"artifactSchemaVersion\":\"${artifact_schema_version}\""* ]] && \
            [[ "$response" == *"\"inventorySchemaVersion\":\"${inventory_schema_version}\""* ]] && \
            [[ "$response" == *"\"inventorySha256\":\"${inventory_sha256}\""* ]] && \
            [[ "$response" == *"\"catalogSha256\":\"${catalog_sha256}\""* ]] && \
            [[ "$response" == *"\"legacyUrlAliasesSha256\":\"${legacy_url_aliases_sha256}\""* ]] && \
            [[ "$response" == *"\"producerTrustPolicySha256\":\"${producer_trust_policy_sha256}\""* ]] && \
            [[ "$response" == *"\"retrocastVersion\":\"${retrocast_version}\""* ]]; then
            return 0
        fi
        sleep 2
    done

    echo "${url} did not report deployment ${deployment_sha} with the reviewed database identity" >&2
    return 1
}

deployment_diagnostics() {
    echo "deployment failed; current service state:" >&2
    compose ps -a >&2 || true
    compose logs --tail=100 app-blue app-green >&2 || true
}

candidate_started=false
cutover_started=false
previous_slot=''
candidate_slot=''
candidate_service=''

rollback_deployment() {
    local exit_code="$1"
    local rollback_succeeded=false

    trap - ERR HUP INT TERM
    set +e
    echo "deployment failed; preserving the previous application slot" >&2

    if [ "$cutover_started" = true ]; then
        if switch_upstream "$previous_slot" && check_health "${public_url}/api/health" 6; then
            rollback_succeeded=true
            echo "restored Nginx to the ${previous_slot} slot" >&2
        else
            echo "automatic Nginx rollback failed; both application slots are being left running" >&2
        fi
    else
        rollback_succeeded=true
    fi

    if [ "$candidate_started" = true ] && [ "$rollback_succeeded" = true ]; then
        if [ "$cutover_started" = true ]; then
            sleep "$drain_seconds"
        fi
        compose stop "$candidate_service" >&2 || true
    fi

    deployment_diagnostics
    exit "$exit_code"
}

handle_signal() {
    local signal_name="$1"
    local exit_code

    case "$signal_name" in
        HUP) exit_code=129 ;;
        INT) exit_code=130 ;;
        TERM) exit_code=143 ;;
        *) exit_code=1 ;;
    esac

    echo "deployment received ${signal_name}; starting rollback" >&2
    rollback_deployment "$exit_code"
}

if ! previous_slot="$(switch_upstream current)"; then
    echo "blue/green Nginx support is not installed on this host" >&2
    echo "run: sudo ./scripts/install-blue-green-deploy.sh" >&2
    exit 1
fi

if ! candidate_slot="$(next_app_slot "$previous_slot")"; then
    echo "Nginx reported an unsupported active slot: $previous_slot" >&2
    exit 1
fi

candidate_service="$(app_service_for_slot "$candidate_slot")"
candidate_port="$(app_port_for_slot "$candidate_slot")"
previous_port="$(app_port_for_slot "$previous_slot")"

check_health "http://127.0.0.1:${previous_port}/api/health" 2 || {
    echo "the active ${previous_slot} application slot is not healthy" >&2
    exit 1
}

trap 'rollback_deployment $?' ERR
trap 'handle_signal HUP' HUP
trap 'handle_signal INT' INT
trap 'handle_signal TERM' TERM

echo "Deploying SynthArena revision $deployment_sha from ${previous_slot} to ${candidate_slot}"

compose pull "$candidate_service"
image_revision="$(docker image inspect "$SYNTHARENA_APP_IMAGE" \
    --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')"
if [ "$image_revision" != "$deployment_sha" ]; then
    echo "candidate image revision is ${image_revision:-missing}, not ${deployment_sha}" >&2
    false
fi

resolved_digest="$(docker image inspect "$SYNTHARENA_APP_IMAGE" \
    --format '{{index .RepoDigests 0}}')"
if [[ "$resolved_digest" != *@"$image_digest" ]]; then
    echo "candidate image resolved to ${resolved_digest:-missing}, not ${image_digest}" >&2
    false
fi

checkout_contract_sha="$(sha256sum "$database_contract_path" | awk '{print $1}')"
image_contract_sha="$(docker run --rm --entrypoint sha256sum "$SYNTHARENA_APP_IMAGE" \
    /app/deployment/database-contract.json | awk '{print $1}')"
if [ "$image_contract_sha" != "$checkout_contract_sha" ]; then
    echo "candidate image database contract does not match the released checkout" >&2
    false
fi

if ! IFS=$'\t' read -r \
        database_schema_version \
        artifact_schema_version \
        inventory_schema_version \
        inventory_sha256 \
        catalog_sha256 \
        legacy_url_aliases_sha256 \
        producer_trust_policy_sha256 \
        retrocast_version \
        < <(docker run --rm --entrypoint node "$SYNTHARENA_APP_IMAGE" -e '
        const contract = require("/app/deployment/database-contract.json")
        const fields = [
            "databaseSchemaVersion",
            "artifactSchemaVersion",
            "inventorySchemaVersion",
            "inventorySha256",
            "catalogSha256",
            "legacyUrlAliasesSha256",
            "producerTrustPolicySha256",
            "retrocastVersion",
        ]
        if (fields.some((field) => contract[field] === undefined || contract[field] === null)) process.exit(1)
        process.stdout.write(fields.map((field) => String(contract[field])).join("\t") + "\n")
    '); then
    echo "candidate image database identity contract could not be read" >&2
    false
fi

if [[ ! "$database_schema_version" =~ ^[0-9]+$ ]] || \
    [[ ! "$artifact_schema_version" =~ ^[0-9]+$ ]] || \
    [[ ! "$inventory_schema_version" =~ ^[0-9]+$ ]] || \
    [[ ! "$inventory_sha256" =~ ^[0-9a-f]{64}$ ]] || \
    [[ ! "$catalog_sha256" =~ ^[0-9a-f]{64}$ ]] || \
    [[ ! "$legacy_url_aliases_sha256" =~ ^[0-9a-f]{64}$ ]] || \
    [[ ! "$producer_trust_policy_sha256" =~ ^[0-9a-f]{64}$ ]] || \
    [[ ! "$retrocast_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "candidate image database identity contract is malformed" >&2
    false
fi

# App releases never replace or copy prod.db. The inactive slot opens the same
# externally published SQLite corpus and proves its schema contract before any
# traffic moves. Corpus publication remains a separate, explicit operation.
candidate_started=true
compose up -d --no-build --wait "$candidate_service"
check_health "http://127.0.0.1:${candidate_port}/api/health" 12
check_deployment_contract "http://127.0.0.1:${candidate_port}" 6

cutover_started=true
switch_upstream "$candidate_slot"
check_health "${public_url}/api/health" 6
check_deployment_contract "$public_url" 6

# The candidate is now committed. Disable rollback before the drain/retirement
# phase so a signal can never restore traffic to an old slot being stopped.
trap - ERR HUP INT TERM

# Nginx keeps old workers alive during a graceful reload. Give in-flight
# requests time to complete before retiring the previous application slot.
sleep "$drain_seconds"

if [ "$previous_slot" = legacy ]; then
    while IFS= read -r legacy_container; do
        [ -n "$legacy_container" ] || continue
        docker rm -f "$legacy_container" || \
            echo "warning: could not remove retired legacy app container ${legacy_container}" >&2
    done < <(
        docker ps -aq \
            --filter "label=com.docker.compose.project=${compose_project_name}" \
            --filter 'label=com.docker.compose.service=app'
    )
else
    previous_service="$(app_service_for_slot "$previous_slot")"
    compose stop "$previous_service" || \
        echo "warning: could not stop the retired ${previous_slot} app slot" >&2
fi

compose ps
echo "SynthArena revision $deployment_sha is healthy on the ${candidate_slot} slot"
