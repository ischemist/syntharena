# SynthArena: An Interactive Platform for Visualizing and Comparing Retrosynthetic Routes

[![isChemist Protocol v1.0.0](https://img.shields.io/badge/protocol-isChemist%20v1.0.0-blueviolet)](https://github.com/ischemist/protocol)
[![arXiv](https://img.shields.io/badge/arXiv-2512.07079-b31b1b.svg)](https://arxiv.org/abs/2512.07079)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/anmorgunov/6077067d66b794810c2c667b79677304/raw/syntharena-coverage.json)](https://github.com/ischemist/syntharena/actions/workflows/tests.yml)

Powered by [RetroCast](https://github.com/ischemist/project-procrustes)

---

## Overview

SynthArena is an open-source web platform for evaluating and comparing AI-driven retrosynthesis models. It provides interactive visualization, side-by-side route comparison, and a living leaderboard for transparent benchmarking in computer-aided synthesis planning (CASP).

The platform ingests standardized predictions from [RetroCast](https://github.com/ischemist/project-procrustes), the unified evaluation framework introduced in our paper: [_"Procrustean Bed for AI-Driven Retrosynthesis: A Unified Framework for Reproducible Evaluation"_](https://arxiv.org/abs/2512.07079).

**Live Demo:** [syntharena.ischemist.com](https://syntharena.ischemist.com)

---

## The Problem

Evaluating retrosynthesis models is fragmented and unreliable:

- **The Babel of Formats:** AiZynthFinder outputs bipartite graphs; Retro\* outputs precursor maps; DirectMultiStep outputs recursive dictionaries. Comparing them requires bespoke parsers for every model.
- **Inconsistent Stocks:** Starting material definitions vary by over 1000×, so stock-constrained results are meaningless without an exact stock identity.
- **Collapsed Validity Claims:** Structural integrity, stock termination, and reaction feasibility are distinct predicates. A single "solved" label hides which evidence was actually established.

---

## The Solution

**RetroCast + SynthArena** provides the missing infrastructure:

- **RetroCast:** A universal translation layer with adapters for 10+ models, casting all outputs into a canonical schema with cryptographic manifests for reproducibility.
- **Curated Benchmarks:** Stratified evaluation sets fixing PaRoutes' distribution skew. The `mkt-` series uses commercial stocks for practical utility; the `ref-` series uses standardized stocks for fair algorithmic comparison.
- **SynthArena:** This platform provides side-by-side route comparison with diff overlays, bootstrapped confidence intervals, and a living leaderboard.

---

## Key Features

- **Interactive Route Visualization:** Explore predicted synthetic routes with molecule structures rendered using SMILES
- **Side-by-Side Comparison:** Compare predictions from any two models or inspect predicted vs. ground-truth routes with diff overlays
- **Living Leaderboard:** Compare target-level Tier-0 validity and Solv-0[stock], plus acceptable-route Top-K accuracy where available
- **Commercial Availability Tracking:** See which leaf nodes are in the ASKCOS Buyables stock (300k commercially available compounds)
- **Fully Reproducible:** All data standardized via RetroCast with cryptographic manifests

---

## Quick Start

### Option 1: Docker (Recommended)

Get the latest database dump and launch the platform. The SQLite database is mounted from `production_data/` at runtime; it is not copied into the Docker image.

```bash
# Download the latest database
curl -fsSL https://files.ischemist.com/syntharena/get-db.sh | bash -s
```

The Docker Compose service sets `DATABASE_URL=file:/app/data/prod.db`, so local `.env` files can keep using development database paths without affecting the container.

By default, Docker Compose mounts `./production_data` into the container. Set `SYNTHARENA_DATA_DIR` to use another host directory containing `prod.db`.

Ensure the data directory exists and is writable by the non-root container user. Docker Compose defaults to uid/gid `1002`, but you can override that with `SYNTHARENA_UID` and `SYNTHARENA_GID` if your host directory uses different ownership.

```bash
mkdir -p "${SYNTHARENA_DATA_DIR:-./production_data}"
chown -R "${SYNTHARENA_UID:-1002}:${SYNTHARENA_GID:-1002}" "${SYNTHARENA_DATA_DIR:-./production_data}"
```

Run migrations with the one-shot `migrate` service before starting a local app slot:

```bash
docker compose --profile tools run --rm migrate
docker compose up --build -d app-blue
```

The platform will be available at [http://localhost:1001](http://localhost:1001).

To use a different port, edit the `ports` section in `docker-compose.yml` (e.g., change `1001:3000` to `3000:3000`). Production uses both app slots; see [Production deployment](docs/operations/deployment.md).

### Option 2: Local Development

Requirements:

- Node.js 22+
- pnpm

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env to configure your database path

# Get the database dump (see Docker option above) or generate your own using the scripts below.
# For local development, point DATABASE_URL at the database path you want to use.

# Run database migrations
pnpm prisma migrate deploy

# Start the development server
pnpm dev
```

The platform will be available at [http://localhost:3000](http://localhost:3000)

### Health Check

`GET /api/health` returns `200` when the Next.js app can reach the SQLite database and `503` with `health.database_unavailable` when the database check fails. It is intended for uptime monitors such as Better Stack.

`GET /api/deployment` reports the image's exact Git revision and the connected corpus database schema version. The production deployer validates both values before and after moving traffic.

The hosted deployment is monitored at [status.ischemist.com](https://status.ischemist.com).

### Environment Configuration

For Docker, `docker-compose.yml` sets the container database path:

```bash
DATABASE_URL="file:/app/data/prod.db"
```

For local development, you can use a different path:

```bash
DATABASE_URL="file:./prisma/dev.db"
```

---

## Rust Corpus Workflow

SynthArena has one ingestion path: the offline Rust corpus tool. It manages a self-contained workspace and compiles that workspace into a new SQLite database. It never incrementally mutates an existing database and never overwrites its output.

The authored `catalog.json` defines stocks, benchmarks, model versions, coverage, and an optional hash-bound legacy URL alias artifact. The generated `inventory.json` locks verified run evidence. Artifacts live under `inputs/`, `bundles/`, and `aliases/`; registration copies them into those confined paths atomically. The current capability gate intentionally accepts only RetroCast v0.8.3 schema-v2 Tier-0 bundles.

Each benchmark's database ID is the full lowercase SHA-256 of its registered gzip artifact. Its unique human name is also its public slug, so the readable URL remains `/benchmarks/mkt-lin-500`; database-backed aliases resolve historical IDs and content-addressed ID URLs to that slug. Reusing a slug for different benchmark bytes is rejected by identity continuity. Scientifically changed benchmark content must use a new versioned slug.

Create a workspace and register data:

```bash
pnpm corpus -- init --corpus /path/to/corpus

pnpm corpus -- add-stock \
  --corpus /path/to/corpus --name buyables-stock \
  --artifact /path/to/buyables-stock.csv.gz \
  --manifest /path/to/buyables-stock.manifest.json

pnpm corpus -- add-stock-enrichment \
  --corpus /path/to/corpus --stock buyables-stock \
  --artifact /path/to/buyables-stock.enrichment.csv.gz \
  --manifest /path/to/buyables-stock.enrichment.manifest.json

pnpm corpus -- add-benchmark \
  --corpus /path/to/corpus --stock buyables-stock --series market \
  --artifact /path/to/mkt-lin-500.json.gz \
  --manifest /path/to/mkt-lin-500.manifest.json

pnpm corpus -- add-model \
  --corpus /path/to/corpus --key askcos \
  --algorithm-name ASKCOS --algorithm-slug askcos \
  --family-name ASKCOS --family-slug askcos \
  --instance-slug askcos-v2-0-0 --version 2.0.0 \
  --default-hourly-cost-usd 0.714

pnpm corpus -- trust-policy \
  --corpus /path/to/corpus \
  --policy corpus/retrocast-v0.8.3.trust-policy.json

pnpm corpus -- add-run \
  --corpus /path/to/corpus --benchmark mkt-lin-500 --model askcos \
  --bundle /path/to/retrocast-evaluate-output \
  --hourly-cost-usd 0.82
```

Stock enrichment is optional and hash-bound to one registered stock. Its gzip CSV must have exactly
`InChIKey,ppg,source,lead_time,link`, with one row per stock member in strictly ascending InChIKey
order. `ppg` may be empty or a finite non-negative number; `source` may be empty or one of
`MC`, `LN`, `EM`, `SA`, and `CB`; non-empty links must use HTTP(S). The schema-v1 JSON manifest is:

```json
{
  "schema_version": 1,
  "action": "export-stock-enrichment",
  "stock_name": "buyables-stock",
  "source": {
    "database_sha256": "<64 lowercase hex characters>",
    "description": "How the enrichment source was produced"
  },
  "artifact": {
    "path": "buyables-stock.enrichment.csv.gz",
    "sha256": "<64 lowercase hex characters>",
    "rows": 313458
  }
}
```

Registration streams and validates the complete artifact, proves exact stock membership, and copies
both files without overwriting. The compiler repeats those checks, uses one prepared update statement
inside the stock transaction, and records the enrichment path, SHA-256, and schema version on `Stock`.

`add-run` verifies every manifest output and source hash while producer paths are available. It also requires `producer.json` to match the hash-bound reviewed trust policy across release version, tag, commit, URL, release asset SHA-256, and executable SHA-256. Later builds recheck the self-contained bundle and producer lock without depending on producer-machine paths. Absolute producer-machine paths are redacted from stored `manifestJson`; the SHA-256 of the original manifest remains the provenance identity.

Cost metadata is optional and explicit. `add-model --default-hourly-cost-usd` records the normal execution price for that model instance; `add-run --hourly-cost-usd` overrides it when a particular run used differently priced hardware. Both values are USD per hour and must be finite and non-negative. The compiler stores the effective hourly rate and computes `totalCost` from the verified planner `totalWallTime`; RetroCast evaluation runtime is never charged as planner cost.

The current `$0.1785`, `$0.714`, and `$1.29` defaults were recovered from the public legacy database with SHA-256 `01a693d1b5604256f6d3b6a4bb7b12ccce982d3050293d2512e9b35358bbdde4`. Those rates were internally consistent across all 103 historical run rows and aliases. The structured `cost_provenance` catalog entry records this source, population, and recovered rate set alongside the per-model assignments.

Coverage is explicit by default. After registering a complete matrix, require every benchmark/model combination:

```bash
pnpm corpus -- coverage --corpus /path/to/corpus --mode cross-product
```

Historical opaque IDs cannot be inferred from their URL shape. Derive their semantic destinations by joining the published legacy database to a canonical staging database. The small checked-in rules file records the exceptional benchmark and model-instance renames; the Rust tool owns the full join and writes deterministic gzip without overwriting an existing artifact:

```bash
pnpm corpus -- derive-aliases \
  --legacy-database /path/to/published-legacy.db \
  --canonical-database /path/to/canonical-staging.db \
  --rules corpus/legacy-url-alias-rules.v1.json \
  --output /path/to/legacy-url-aliases.v1.json.gz \
  --source-description "Published SynthArena database dump <artifact> (decompressed)"

pnpm corpus -- aliases --corpus /path/to/corpus \
  --artifact /path/to/legacy-url-aliases.v1.json.gz

pnpm corpus -- validate --corpus /path/to/corpus
```

The generated manifest records SHA-256 identities for the legacy database, canonical database, and rules file alongside the source description. Registration validates that provenance and the complete decompressed manifest against the corpus, copies it to a SHA-addressed `aliases/legacy-url-aliases.<sha256>.json.gz` path, and binds that compressed-artifact hash in `catalog.json`. Full generated alias artifacts stay outside Git; only the compact derivation rules and Rust test fixtures are checked in.

Compile a staging database:

```bash
pnpm rebuild:corpus -- \
  --corpus /path/to/corpus \
  --output /path/to/new/syntharena-staging.db
```

The first database is a bootstrap and may omit an identity baseline. Every later reviewed corpus build should protect existing public identities and scientific bindings:

```bash
pnpm rebuild:corpus -- \
  --corpus /path/to/corpus \
  --output /path/to/new/syntharena-staging.db \
  --identity-baseline /path/to/current/published.db
```

The continuity audit rejects removed or scientifically changed existing stock, benchmark, model-instance, and benchmark/model-instance run identities while allowing new ones. It permits cost fields to be filled when a pre-cost baseline contains `NULL`, but once either `hourlyCost` or `totalCost` is non-null it must remain present and exactly unchanged for that run. This is the code-enforced continuity boundary; a slug is not globally immutable without a baseline.

The builder streams targets into prepared SQLite statements with bounded memory, executes the checked-in Prisma baseline, and verifies candidate/evaluation alignment, Tier/Solv metrics, provenance, aliases, foreign keys, and SQLite integrity before no-clobber promotion. Repeated route-node producer payload is stored once in a content-addressed dictionary, while compact integer occurrences retain topology and molecule identity. `--limit N` is available for local parity work and always marks the result `local-provisional`. No corpus command copies into `production_data`, publishes, merges, or deploys SynthArena.

The compiler carries a small local deserialization projection of the pinned RetroCast v0.8.3 wire format; it does not link `retrocast-core`. The v0.8.3 core is not published as a standalone crate and its Git package includes the complete execution engine, a CXX build script, chemistry code, HTTP clients, randomization, and parallel execution. Pulling that surface into a streaming SQLite compiler would make the offline loader materially heavier without removing the need for corpus-specific validation. A checked-in v0.8.3 golden wire fixture, the exact producer trust lock, and full-bundle validation define the compatibility boundary. Supporting another RetroCast artifact schema requires a new explicit capability gate and fixture; if multiple consumers need to evolve these types together, the right follow-up is a lean, published schema crate extracted from Procrustes rather than a dependency on the execution core.

The compiler rejects a second run for the same benchmark/model version. One result must be designated canonical until the schema gains a submission or replicate identity. Only a genuinely changed model or planner configuration should receive a new model instance/version.

---

## Technology Stack

- **Framework:** Next.js 16 (App Router, React Server Components)
- **Database:** SQLite (via Prisma ORM)
- **UI:** Tailwind CSS, shadcn/ui, Radix UI
- **Visualization:** @xyflow/react (route graphs), Recharts (performance charts), smiles-drawer (molecular structures)
- **Type Safety:** TypeScript with strict mode, Zod schemas

---

## Project Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── benchmarks/              # Benchmark listing and details
│   ├── leaderboard/             # Performance comparison
│   ├── runs/                    # Model prediction browser
│   └── stocks/                  # Stock catalog
├── components/
│   ├── route-visualization/     # Route graph rendering
│   ├── metrics/                 # Performance metrics displays
│   └── ui/                      # Reusable UI components
├── lib/
│   ├── services/                # Business logic (framework-agnostic)
│   ├── validation/              # Zod schemas
│   └── route-visualization/     # Graph layout algorithms
└── types/                        # TypeScript type definitions

prisma/
├── schema.prisma                # Database schema
└── migrations/                  # Database migrations

scripts/
├── audit-database-parity.ts     # Compare generated databases
└── export-*.ts                  # Export publication tables

tools/
└── corpus-builder/              # Rust workspace manager and database compiler
```

---

## Data Pipeline

SynthArena displays data processed through the RetroCast pipeline:

1. **Raw Predictions:** Model outputs in native formats (JSON, YAML, etc.)
2. **RetroCast Standardization:** `retrocast adapt` translates to canonical schema
3. **Evaluation:** `retrocast evaluate` emits one manifest-verified fused bundle with explicit validity tiers and constraints
4. **Database Build:** The Rust corpus compiler creates a verified, immutable SQLite artifact
5. **SynthArena:** Interactive visualization and exploration

For details on generating predictions and scores, see the [RetroCast documentation](https://github.com/ischemist/project-procrustes).

---

## Development Commands

```bash
# Development server
pnpm dev

# Type checking
pnpm check-types

# Linting
pnpm lint

# Build for production
pnpm build

# Start production server
pnpm start

# Database operations
pnpm prisma generate      # Generate Prisma client
pnpm prisma migrate dev   # Create new migration
pnpm prisma migrate deploy # Apply migrations
pnpm prisma studio        # Open database GUI
```

---

## Citation

If you use SynthArena in your research, please cite our paper:

```bibtex
@misc{retrocast,
  title         = {Procrustean Bed for AI-Driven Retrosynthesis: A Unified Framework for Reproducible Evaluation},
  author        = {Anton Morgunov and Victor S. Batista},
  year          = {2025},
  eprint        = {2512.07079},
  archiveprefix = {arXiv},
  primaryclass  = {cs.LG},
  url           = {https://arxiv.org/abs/2512.07079}
}
```

---

## Contributing

We welcome contributions! This project follows the [isChemist Protocol](https://github.com/ischemist/protocol) for reproducible computational chemistry research.

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

## Related Resources

- **RetroCast Framework:** [github.com/ischemist/project-procrustes](https://github.com/ischemist/project-procrustes)
- **Paper:** [arxiv.org/abs/2512.07079](https://arxiv.org/abs/2512.07079)
- **Publication Data:** [files.ischemist.com/retrocast/publication-data](https://files.ischemist.com/retrocast/publication-data)
- **Live Platform:** [syntharena.ischemist.com](https://syntharena.ischemist.com)
- **Service Status:** [status.ischemist.com](https://status.ischemist.com)

---

## Questions & Feedback

For issues or feature requests, please open an issue on [GitHub](https://github.com/ischemist/syntharena/issues).

For general questions about RetroCast or SynthArena, contact: anton@ischemist.com
