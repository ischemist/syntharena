## Loading Stock

```bash
pnpm tsx scripts/load-stock.ts /Users/morgunov/Developer/ischemist/project-procrustes/data/1-benchmarks/stocks/buyables-stock.csv "ASKCOS Buyables Stock" "Compounds available for less than \$100/g from eMolecules, Sigma-Aldrich, LabNetwork, Mcule, and ChemBridge, curated by ASKCOS team"
pnpm tsx scripts/load-stock.ts /Users/morgunov/Developer/ischemist/project-procrustes/data/1-benchmarks/stocks/n1-stock.csv "n1 Stock" "A set of all leaves from routes in PaRoutes n1 evaluation set"
pnpm tsx scripts/load-stock.ts /Users/morgunov/Developer/ischemist/project-procrustes/data/1-benchmarks/stocks/n5-stock.csv "n5 Stock" "A set of all leaves from routes in PaRoutes n5 evaluation set"
pnpm tsx scripts/load-stock.ts /Users/morgunov/Developer/ischemist/project-procrustes/data/1-benchmarks/stocks/n1-n5-stock.csv "n1+n5 Stock" "A set of all leaves from routes in PaRoutes n1 and n5 evaluation sets"
```

## Loading Benchmarks

```bash
pnpm tsx scripts/load-benchmark.ts /Users/morgunov/Developer/ischemist/project-procrustes/data/1-benchmarks/definitions/uspto-190.json.gz "uspto-190" "190 targets from the test set of the original Retro*" --stock "ASKCOS Buyables Stock"

pnpm tsx scripts/load-benchmark.ts /Users/morgunov/Developer/ischemist/project-procrustes/data/1-benchmarks/definitions/mkt-cnv-160.json.gz "mkt-cnv-160" "160 targets with convergent ground truth routes of variable length with all leaves in buyables. Part of the Procrustes suite." --stock "ASKCOS Buyables Stock"

pnpm tsx scripts/load-benchmark.ts /Users/morgunov/Developer/ischemist/project-procrustes/data/1-benchmarks/definitions/mkt-lin-500.json.gz "mkt-lin-500" "500 targets with linear ground truth routes of variable length with all leaves in buyables. Part of the Procrustes suite." --stock "ASKCOS Buyables Stock"

pnpm tsx scripts/load-benchmark.ts /Users/morgunov/Developer/ischemist/project-procrustes/data/1-benchmarks/definitions/ref-lin-600.json.gz "ref-lin-600" "600 targets with linear ground truth routes of variable length. Part of the Procrustes suite." --stock "n5 Stock"

pnpm tsx scripts/load-benchmark.ts /Users/morgunov/Developer/ischemist/project-procrustes/data/1-benchmarks/definitions/ref-cnv-400.json.gz "ref-cnv-400" "400 targets with convergent ground truth routes of variable length. Part of the Procrustes suite." --stock "n5 Stock"

pnpm tsx scripts/load-benchmark.ts /Users/morgunov/Developer/ischemist/project-procrustes/data/1-benchmarks/definitions/ref-lng-84.json.gz "ref-lng-84" "84 targets with extra long ground truth routes" --stock "n1+n5 Stock"

pnpm tsx scripts/load-benchmark.ts /Users/morgunov/Developer/ischemist/project-procrustes/data/1-benchmarks/definitions/mkt-cnv-160-single-gt.json.gz "mkt-cnv-160-single-gt" "160 targets with convergent ground truth routes of variable length with all leaves in buyables. Part of the Procrustes suite." --stock "ASKCOS Buyables Stock"

pnpm tsx scripts/load-benchmark.ts /Users/morgunov/Developer/ischemist/project-procrustes/data/1-benchmarks/definitions/mkt-lin-500-single-gt.json.gz "mkt-lin-500-single-gt" "500 targets with linear ground truth routes of variable length with all leaves in buyables. Part of the Procrustes suite." --stock "ASKCOS Buyables Stock"

```

```bash
pnpm tsx scripts/load-predictions.ts mkt-cnv-160 dms-explorer-xl --algorithm DirectMultiStep --model-version "v1.0" --algorithm-paper "https://arxiv.org/abs/2405.13983" --stock-path buyables-stock --stock-db "ASKCOS Buyables Stock" --hourly-cost 1.20
pnpm tsx scripts/load-predictions.ts mkt-cnv-160 aizynthfinder-retro-star --algorithm "AiZynthFinder Retro*" --stock-path buyables-stock --stock-db "ASKCOS Buyables Stock"
pnpm tsx scripts/load-predictions.ts mkt-cnv-160 retro-star --algorithm "Retro*" --stock-path buyables-stock --stock-db "ASKCOS Buyables Stock"
pnpm tsx scripts/load-predictions.ts mkt-cnv-160 askcos --algorithm "ASKCOS" --stock-path buyables-stock --stock-db "ASKCOS Buyables Stock"

pnpm tsx scripts/load-predictions.ts uspto-190 dms-explorer-xl --algorithm DirectMultiStep --model-version "v1.0" --algorithm-paper "https://arxiv.org/abs/2405.a13983" --stock-path buyables-stock --stock-db "ASKCOS Buyables Stock"
pnpm tsx scripts/load-predictions.ts uspto-190 aizynthfinder-retro-star --algorithm "AiZynthFinder Retro*" --stock-path buyables-stock --stock-db "ASKCOS Buyables Stock"
pnpm tsx scripts/load-predictions.ts uspto-190 retro-star --algorithm "Retro*" --stock-path buyables-stock --stock-db "ASKCOS Buyables Stock"
pnpm tsx scripts/load-predictions.ts uspto-190 askcos --algorithm "ASKCOS" --stock-path buyables-stock --stock-db "ASKCOS Buyables Stock"
```
