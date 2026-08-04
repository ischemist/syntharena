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

Run migrations with the one-shot `migrate` service before starting the app:

```bash
docker compose --profile tools run --rm migrate
docker compose up --build -d app
```

The platform will be available at [http://localhost:1000](http://localhost:1000)

To use a different port, edit the `ports` section in `docker-compose.yml` (e.g., change `1000:3000` to `3000:3000`).

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

## Production Database Builder

SynthArena's production corpus path is an offline Rust builder. It streams RetroCast targets into prepared SQLite statements with bounded memory, executes the checked-in Prisma baseline SQL, records the applied migration, validates every artifact and database invariant, and promotes a completed database without overwriting an existing path. The TypeScript/Prisma importer remains a correctness and parity reference.

A corpus contains an `inventory.json` with `publication_status: "staging"`, benchmark and stock inputs, and one fused bundle per benchmark/model pair. The builder accepts only the exact RetroCast v0.8.3 release and schema-v2 Tier-0 contract. It requires Rust 1.85 or newer; Node.js is only needed for the reference importer and application.

### Prerequisites

1. Produce schema-v2 fused evaluation bundles with RetroCast.
2. Build an inventory covering the complete benchmark/model matrix.
3. Choose a new output path; the command refuses to overwrite an existing database.

### Build the staging database

```bash
pnpm rebuild:corpus -- \
  --corpus /path/to/syntharena-corpus \
  --output /path/to/new/syntharena-staging.db
```

The command builds beside `--output`, applies rebuild-only SQLite settings, loads the three stocks, six benchmarks, and 14 model instances, then verifies and imports all 84 bundles one transaction at a time. Candidate and evaluation streams must agree target by target. Tier/Solv metrics, strata, counts, hashes, exact target bindings, foreign keys, provenance, and SQLite integrity are checked before a hard-link no-clobber promotion. The final report includes elapsed time, peak RSS, size, status, and imported-run count.

`--limit N` builds a nonempty inventory prefix for parity work and forces `publicationStatus` to `local-provisional`. A full build remains `staging`. Both outputs are review artifacts: this command does not copy them into `production_data`, publish them, merge them into a release, or deploy SynthArena.

### Run the reference importer

```bash
pnpm rebuild:corpus:reference -- \
  --corpus /path/to/syntharena-corpus \
  --output /path/to/new/syntharena-reference.db \
  --allow-provisional
```

`--allow-provisional` is required for the official staging corpus and does not
promote or publish the resulting database. Use
`pnpm audit:database-parity -- --reference ... --candidate ...` to compare
semantic table counts, metrics, provenance, and normalized schema metadata. The
lower-level TypeScript importer remains useful for development and differential
testing; Rust is the production rebuild path.

For a single independently prepared bundle, use `scripts/load-predictions.ts --bundle ... --benchmark ... --model ...` after its stock, benchmark, and model rows exist.

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
├── load-benchmark.ts            # Load benchmark definitions
├── load-predictions.ts          # Load model predictions
├── load-stock.ts                # Load stock catalogs
└── rebuild-corpus.ts            # TypeScript correctness/reference rebuild

tools/
└── corpus-builder/              # Production offline Rust database builder
```

---

## Data Pipeline

SynthArena displays data processed through the RetroCast pipeline:

1. **Raw Predictions:** Model outputs in native formats (JSON, YAML, etc.)
2. **RetroCast Standardization:** `retrocast adapt` translates to canonical schema
3. **Evaluation:** `retrocast evaluate` emits one manifest-verified fused bundle with explicit validity tiers and constraints
4. **Database Load:** The corpus inventory orchestrates a resumable, verified SQLite rebuild
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
