# Production deployment

SynthArena promotes stable GitHub Releases through `.github/workflows/deploy-production.yml`. Pull requests and ordinary master pushes build and test immutable images, but do not change production. Publishing a non-prerelease `vMAJOR.MINOR.PATCH` release deploys the release's exact commit. An explicit workflow dispatch can redeploy an exact full SHA from master.

## Delivery invariants

- The revision is a full SHA in master history and contains deployment contract 2.
- Tests, code quality, the Rust corpus builder, and Docker image workflows all succeeded for that exact master revision.
- CI resolves `ghcr.io/ischemist/syntharena:sha-<full-sha>` once, before SSH, and production deploys only the resulting `ghcr.io/ischemist/syntharena@sha256:<digest>` reference. Mutable tags are never host deployment inputs.
- The pulled image label, candidate `/api/deployment`, and public `/api/deployment` must all report the exact SHA.
- Deployments are serialized through the GitHub `Production` environment and are never cancelled in progress.
- Registry credentials exist only in a temporary remote Docker configuration and are removed on every exit path.
- Nginx continues serving the active slot while the inactive slot starts and validates on loopback.
- A failure before cutover leaves the active slot untouched. A failure after cutover restores the prior upstream; the failed candidate is stopped only after rollback health succeeds.

## SQLite and corpus ownership

Application release and corpus publication are deliberately separate operations. Both app slots mount the same external `${SYNTHARENA_DATA_DIR}/prod.db` directory read-only and open SQLite with `readonly` and `fileMustExist`; the migration tool retains its separate writable mount. The image contains no corpus and `scripts/deploy.sh` never copies, replaces, downloads, migrates, or removes that database.

`deployment/database-contract.json` is the reviewed app/database identity contract. The candidate must report matching database, artifact, and inventory schema versions; inventory, catalog, legacy-alias, and producer-trust hashes; and RetroCast version before Nginx can switch. `publicationStatus` is intentionally not part of compatibility identity. This prevents an unrelated schema-v2 database from passing the gate.

If a future app needs a different corpus, publish and verify it through the corpus-release procedure first, then update the reviewed identity contract in the app release. The current shared-file topology cannot make an incompatible database replacement zero-downtime: that requires immutable per-slot database file bindings so the active and candidate applications can overlap against different corpus files. That extension is not implemented or claimed here.

Schema changes must remain readable by the active app for the whole overlap window. Prefer additive changes. Do not combine a destructive schema transition with an application release and assume application rollback remains safe.

Published databases must be checkpointed and closed cleanly before promotion, with no pending `prod.db-wal` transaction. Read-only application containers cannot create or repair WAL/SHM state. Corpus publication must verify SQLite integrity and open the final file read-only before changing the live binding.

## GitHub Production environment

The workflow requires these environment secrets:

- `PRODUCTION_SSH_PRIVATE_KEY`
- `PRODUCTION_SSH_KNOWN_HOSTS`

It requires these environment variables:

- `PRODUCTION_SSH_HOST`
- `PRODUCTION_SSH_PORT`
- `PRODUCTION_SSH_USER`

The CI SSH identity must be a new unattended deployment identity restricted to this host and command surface; never use a personal YubiKey. The installed authorized-key entry uses `restrict,command="/usr/local/sbin/syntharena-deploy-command"`, and the wrapper accepts only `syntharena-deploy <full-sha> <sha256:digest> <validated-github-actor>`. It consumes the job-scoped GHCR token on stdin, keeps credentials in a temporary Docker configuration, validates the public checkout and contract, and invokes the reviewed deploy script. Because the forced command runs as root, its small parser and installed file are a privileged risk boundary; CI never receives an unrestricted root shell.

Set `PRODUCTION_SSH_USER=root` for that dedicated forced key. `PRODUCTION_SSH_HOST` and `PRODUCTION_SSH_KNOWN_HOSTS` must identify the inspected production host; `PRODUCTION_SSH_PRIVATE_KEY` is the matching dedicated private key. `PRODUCTION_SSH_PORT` is optional and defaults to `22`.

## One-time checkout and CI-key bootstrap

`/var/www/syntharena` is a configuration root, not a Git checkout. The bootstrap preserves its existing `.env`, `production_data/`, and running legacy port-1000 container. From a clean checkout of the merged contract-2 revision, supply a newly generated unattended Ed25519 public key explicitly:

```bash
sudo ./scripts/install-production-deploy.sh /secure/path/syntharena-ci.pub
```

The installer clones only `https://github.com/ischemist/syntharena.git` into a temporary sibling, proves the exact bootstrap SHA belongs to public `master` and supports contract 2, checks it out detached, links `/var/www/syntharena/app/.env` to the preserved `/var/www/syntharena/.env`, and atomically promotes the clean checkout to `/var/www/syntharena/app`. It installs the root-owned forced-command wrapper and replaces any occurrence of the supplied key with one exact restricted authorized-key line. Reruns are idempotent. Any failure restores the previous app checkout, wrapper, and authorized-keys file; configuration, corpus data, and the legacy container are not touched.

The checkout/key installer has no option to install or modify Nginx. Nginx bootstrap remains a deliberate second operation after live inspection.

## One-time blue/green bootstrap

Contract 2 needs one read-only-to-traffic host transition before the first automated release. This bootstrap remains a separate P0 operation and must not be attempted until the live Nginx state has been inspected. The installer preserves the current legacy Compose app on port `1000` as the initial upstream. Once the live layout is confirmed, run it from a contract-2 checkout only while that app is healthy:

```bash
cd /var/www/syntharena/app
sudo ./scripts/install-blue-green-deploy.sh
```

If the Nginx site is not `/etc/nginx/sites-enabled/syntharena`, pass its exact path:

```bash
sudo env SYNTHARENA_NGINX_SITE=/etc/nginx/sites-enabled/<site> \
  /var/www/syntharena/app/scripts/install-blue-green-deploy.sh
```

The installer:

- snapshots every Nginx, helper, sudoers, and readiness path it may replace
- rewrites only an expected `proxy_pass` to legacy port `1000`
- creates root-owned upstreams for legacy `1000`, blue `1001`, and green `1002`
- installs an atomic, validated Nginx switch helper
- grants the repository owner only the four required helper invocations when it is not root
- validates and reloads Nginx before publishing the readiness marker
- restores the complete previous state if installation or a repeat installation fails

Installation does not start a new app or move traffic away from the legacy app. The first release starts blue, validates it against the existing external database, switches traffic, drains requests, and then retires the legacy container.

## Deployment and rollback sequence

The forced-command wrapper updates the clean application checkout at `/var/www/syntharena/app` to the exact released SHA and runs:

```bash
./scripts/deploy.sh <full-git-sha> <sha256:image-digest>
```

The script takes a non-blocking host `flock`, discards ambient Compose control variables, and always invokes the checked-in Compose file by absolute path. It identifies the active Nginx slot, verifies its health with finite network timeouts, pulls only the inactive slot's digest-pinned image, validates the registry digest, OCI revision label, and embedded database contract, starts the candidate, and validates health, revision, and database identity directly. It then switches Nginx atomically and repeats validation through the public HTTPS endpoint. After the drain interval it stops the old slot.

Errors and HUP, INT, or TERM signals use the same rollback path. Automatic rollback restores the previous Nginx upstream and verifies public health before stopping the candidate. If that verification fails, both slots remain running for manual recovery. The deployment never rolls the database backward.

For an intentional application rollback, dispatch the workflow with a prior contract-2 SHA that is still compatible with the current external database. Contract-1 releases expect the legacy single-app topology and fail closed after bootstrap.
