-- AlterTable
ALTER TABLE "CompanyProduct" ADD COLUMN "quotationExpiryDate" DATETIME;

-- CreateTable
CREATE TABLE "CompanyProductPriceSchedule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyProductId" INTEGER NOT NULL,
    "scheduledPrice" REAL NOT NULL,
    "effectiveDate" DATETIME NOT NULL,
    "isApplied" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompanyProductPriceSchedule_companyProductId_fkey" FOREIGN KEY ("companyProductId") REFERENCES "CompanyProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CompanyProductPriceSchedule_effectiveDate_isApplied_idx" ON "CompanyProductPriceSchedule"("effectiveDate", "isApplied");
