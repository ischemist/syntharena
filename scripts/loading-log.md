```bash
pnpm tsx scripts/load-predictions.ts mkt-cnv-160 dms-explorer-xl --algorithm DirectMultiStep --model-version "v1.0" --algorithm-paper "https://arxiv.org/abs/2405.13983" --stock-path buyables-stock --stock-db "ASKCOS Buyables Stock"
pnpm tsx scripts/load-predictions.ts mkt-cnv-160 aizynthfinder-retro-star --algorithm "AiZynthFinder Retro*" --stock-path buyables-stock --stock-db "ASKCOS Buyables Stock"
pnpm tsx scripts/load-predictions.ts mkt-cnv-160190 retro-star --algorithm "Retro*" --stock-path buyables-stock --stock-db "ASKCOS Buyables Stock"
pnpm tsx scripts/load-predictions.ts mkt-cnv-160 askcos --algorithm "ASKCOS" --stock-path buyables-stock --stock-db "ASKCOS Buyables Stock"

pnpm tsx scripts/load-predictions.ts uspto-190 dms-explorer-xl --algorithm DirectMultiStep --model-version "v1.0" --algorithm-paper "https://arxiv.org/abs/2405.13983" --stock-path buyables-stock --stock-db "ASKCOS Buyables Stock"
pnpm tsx scripts/load-predictions.ts uspto-190 aizynthfinder-retro-star --algorithm "AiZynthFinder Retro*" --stock-path buyables-stock --stock-db "ASKCOS Buyables Stock"
pnpm tsx scripts/load-predictions.ts uspto-190 retro-star --algorithm "Retro*" --stock-path buyables-stock --stock-db "ASKCOS Buyables Stock"
pnpm tsx scripts/load-predictions.ts uspto-190 askcos --algorithm "ASKCOS" --stock-path buyables-stock --stock-db "ASKCOS Buyables Stock"
```
