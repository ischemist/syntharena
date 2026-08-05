#!/usr/bin/env bash
set -euo pipefail

image="${1:-}"
if [[ ! "$image" =~ ^ghcr\.io/ischemist/syntharena:sha-[0-9a-f]{40}$ ]]; then
    echo "usage: resolve-image-digest.sh ghcr.io/ischemist/syntharena:sha-<full-sha>" >&2
    exit 64
fi

raw_manifest="$(mktemp)"
cleanup() {
    rm -f "$raw_manifest"
}
trap cleanup EXIT

# An OCI/Docker manifest digest is the SHA-256 of its exact registry bytes.
# Hash --raw output instead of parsing version-dependent human/Go-template
# output from buildx; for a multi-platform image this is the top-level index.
docker buildx imagetools inspect "$image" --raw >"$raw_manifest"
if [ ! -s "$raw_manifest" ]; then
    echo "registry returned an empty top-level image manifest" >&2
    exit 1
fi

manifest_sha="$(sha256sum "$raw_manifest" | awk '{print $1}')"
if [[ ! "$manifest_sha" =~ ^[0-9a-f]{64}$ ]]; then
    echo "could not hash the top-level image manifest" >&2
    exit 1
fi

printf 'sha256:%s\n' "$manifest_sha"
