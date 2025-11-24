-- CreateTable
CREATE TABLE "Molecule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inchikey" TEXT NOT NULL,
    "smiles" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Stock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stockId" TEXT NOT NULL,
    "moleculeId" TEXT NOT NULL,
    CONSTRAINT "StockItem_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockItem_moleculeId_fkey" FOREIGN KEY ("moleculeId") REFERENCES "Molecule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Molecule_inchikey_key" ON "Molecule"("inchikey");

-- CreateIndex
CREATE INDEX "Molecule_smiles_idx" ON "Molecule"("smiles");

-- CreateIndex
CREATE UNIQUE INDEX "Stock_name_key" ON "Stock"("name");

-- CreateIndex
CREATE UNIQUE INDEX "StockItem_stockId_moleculeId_key" ON "StockItem"("stockId", "moleculeId");
