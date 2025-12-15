-- CreateIndex
CREATE INDEX "Molecule_inchikey_smiles_idx" ON "Molecule"("inchikey", "smiles");

-- CreateIndex
CREATE INDEX "StockItem_stockId_source_ppg_idx" ON "StockItem"("stockId", "source", "ppg");

-- CreateIndex
CREATE INDEX "StockItem_stockId_ppg_idx" ON "StockItem"("stockId", "ppg");

-- CreateIndex
CREATE INDEX "StockItem_stockId_moleculeId_idx" ON "StockItem"("stockId", "moleculeId");
