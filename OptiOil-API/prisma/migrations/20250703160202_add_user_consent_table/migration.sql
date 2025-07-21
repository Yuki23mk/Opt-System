-- CreateTable
CREATE TABLE "UserConsent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "agreedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "UserConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UserConsent_userId_documentType_idx" ON "UserConsent"("userId", "documentType");

-- CreateIndex
CREATE UNIQUE INDEX "UserConsent_userId_documentType_documentVersion_key" ON "UserConsent"("userId", "documentType", "documentVersion");
