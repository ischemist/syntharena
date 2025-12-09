# SynthArena: An Interactive Platform for Visualizing and Comparing Retrosynthetic Routes

[![isChemist Protocol v1.0.0](https://img.shields.io/badge/protocol-isChemist%20v1.0.0-blueviolet)](https://github.com/ischemist/protocol)
[![arXiv](https://img.shields.io/badge/arXiv-2512.07079-b31b1b.svg)](https://arxiv.org/abs/2512.07079)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

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
- **Inconsistent Stocks:** Starting material definitions vary by over 1000×—making reported solvability scores incomparable across publications.
- **Solvability ≠ Validity:** Routes marked as "solved" are validated only by endpoint availability, with no guarantee that intermediate transformations are chemically feasible.

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
- **Living Leaderboard:** Browse stratified performance metrics (Stock-Termination Rate, Top-K Accuracy) with bootstrapped 95% confidence intervals
- **Commercial Availability Tracking:** See which leaf nodes are in the ASKCOS Buyables stock (300k commercially available compounds)
- **Fully Reproducible:** All data standardized via RetroCast with cryptographic manifests

---

## Quick Start

### Option 1: Docker (Recommended)

Get the latest database dump and launch the platform:

```bash
# Download the latest database
curl -fsSL https://files.ischemist.com/syntharena/get-db.sh | bash -s

# Launch with Docker Compose
docker compose up --build -d
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

# Get the database dump (see Docker option above)
# Place it in production_data/syntharena.db
# OR generate your own using the scripts below

# Run database migrations
pnpm prisma migrate deploy

# Start the development server
pnpm dev
```

The platform will be available at [http://localhost:3000](http://localhost:3000)

### Environment Configuration

The `.env` file requires only one variable:

```bash
DATABASE_URL="file:./production_data/syntharena.db"
```

For local development, you can use a different path:

```bash
DATABASE_URL="file:./prisma/dev.db"
```

---

## Building Your Own Database

If you want to evaluate your own models or create a custom benchmark, you can generate a database from RetroCast outputs.

### Prerequisites

1. Install RetroCast: `uv tool install retrocast`
2. Run the RetroCast pipeline to generate predictions (see [RetroCast docs](https://github.com/ischemist/project-procrustes))
3. Ensure you have the following outputs:
    - Benchmark definitions: `data/1-benchmarks/definitions/*.json.gz`
    - Stock definitions: `data/1-benchmarks/stocks/*.txt`
    - Processed routes: `data/3-processed/<benchmark>/<model>/routes.json.gz`
    - Evaluations: `data/4-scored/<benchmark>/<model>/<stock>/evaluation.json.gz`
    - Statistics: `data/5-results/<benchmark>/<model>/<stock>/statistics.json.gz`

### Loading Data

The loading process follows this sequence:

#### 1. Load Stocks

```bash
pnpm tsx scripts/load-stock.ts \
  /path/to/retrocast/data/1-benchmarks/stocks/buyables-stock.txt \
  "ASKCOS Buyables Stock" \
  "Compounds available from eMolecules, Sigma-Aldrich, LabNetwork, Mcule, and ChemBridge"
```

#### 2. Load Benchmarks

```bash
pnpm tsx scripts/load-benchmark.ts \
  /path/to/retrocast/data/1-benchmarks/definitions/mkt-cnv-160.json.gz \
  "mkt-cnv-160" \
  "160 targets with convergent routes, all leaves in buyables" \
  --stock "ASKCOS Buyables Stock"
```

#### 3. Load Model Predictions

```bash
# Load routes only
pnpm tsx scripts/load-predictions.ts \
  mkt-cnv-160 \
  dms-explorer-xl \
  --algorithm "DirectMultiStep" \
  --routes-only

# Load routes + evaluations + statistics
pnpm tsx scripts/load-predictions.ts \
  mkt-cnv-160 \
  dms-explorer-xl \
  --algorithm "DirectMultiStep" \
  --stock-path "buyables-stock" \
  --stock-db "ASKCOS Buyables Stock" \
  --data-dir /path/to/retrocast/data
```

For batch loading multiple models, see `scripts/batch-load-predictions.sh`.

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
└── batch-load-predictions.sh   # Batch loading utility
```

---

## Data Pipeline

SynthArena displays data processed through the RetroCast pipeline:

1. **Raw Predictions:** Model outputs in native formats (JSON, YAML, etc.)
2. **RetroCast Standardization:** `retrocast adapt` translates to canonical schema
3. **Evaluation:** `retrocast score` calculates metrics against benchmarks
4. **Database Load:** Standardized routes and scores are loaded into SQLite via scripts
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

---

## Questions & Feedback

For issues or feature requests, please open an issue on [GitHub](https://github.com/ischemist/syntharena/issues).

For general questions about RetroCast or SynthArena, contact: anton@ischemist.com
