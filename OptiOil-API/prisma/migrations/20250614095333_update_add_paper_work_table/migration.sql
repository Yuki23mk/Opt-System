-- CreateTable
CREATE TABLE "OrderPaperwork" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "filePath" TEXT,
    "s3Url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "deliveryDate" DATETIME,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" DATETIME,
    "approvedBy" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrderPaperwork_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderPaperwork_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderPaperwork_documentNumber_key" ON "OrderPaperwork"("documentNumber");

-- CreateIndex
CREATE INDEX "OrderPaperwork_orderId_documentType_idx" ON "OrderPaperwork"("orderId", "documentType");

-- CreateIndex
CREATE UNIQUE INDEX "OrderPaperwork_orderId_documentType_key" ON "OrderPaperwork"("orderId", "documentType");
