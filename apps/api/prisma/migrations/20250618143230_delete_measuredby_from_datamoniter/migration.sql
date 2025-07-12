/*
  Warnings:

  - You are about to drop the column `deviceInfo` on the `DataMonitorMeasurement` table. All the data in the column will be lost.
  - You are about to drop the column `measuredBy` on the `DataMonitorMeasurement` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DataMonitorMeasurement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "values" JSONB NOT NULL,
    "note" TEXT,
    "validationStatus" TEXT,
    "alertFlags" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DataMonitorMeasurement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "DataMonitorProject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_DataMonitorMeasurement" ("alertFlags", "createdAt", "date", "id", "note", "projectId", "updatedAt", "validationStatus", "values") SELECT "alertFlags", "createdAt", "date", "id", "note", "projectId", "updatedAt", "validationStatus", "values" FROM "DataMonitorMeasurement";
DROP TABLE "DataMonitorMeasurement";
ALTER TABLE "new_DataMonitorMeasurement" RENAME TO "DataMonitorMeasurement";
CREATE INDEX "DataMonitorMeasurement_projectId_date_idx" ON "DataMonitorMeasurement"("projectId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
