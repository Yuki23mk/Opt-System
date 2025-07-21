-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProductDocument" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productMasterId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "uploadedById" INTEGER,
    "uploadedByAdminId" INTEGER,
    "filename" TEXT NOT NULL,
    "storedFilename" TEXT,
    "s3Url" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "category" TEXT DEFAULT 'manual',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProductDocument_uploadedByAdminId_fkey" FOREIGN KEY ("uploadedByAdminId") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProductDocument_productMasterId_fkey" FOREIGN KEY ("productMasterId") REFERENCES "AdminProductMaster" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProductDocument" ("category", "companyId", "createdAt", "filename", "id", "isPublic", "mimeType", "productMasterId", "s3Url", "size", "storedFilename", "updatedAt", "uploadedById") SELECT "category", "companyId", "createdAt", "filename", "id", "isPublic", "mimeType", "productMasterId", "s3Url", "size", "storedFilename", "updatedAt", "uploadedById" FROM "ProductDocument";
DROP TABLE "ProductDocument";
ALTER TABLE "new_ProductDocument" RENAME TO "ProductDocument";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
