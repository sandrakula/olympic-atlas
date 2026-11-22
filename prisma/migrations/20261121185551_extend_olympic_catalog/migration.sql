-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OlympicEdition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "heldYear" INTEGER,
    "season" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'HELD',
    "startDate" DATETIME,
    "endDate" DATETIME,
    "hostCity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "historicalNote" TEXT,
    "athleteCount" INTEGER,
    "delegationCount" INTEGER,
    "sportCount" INTEGER,
    "eventCount" INTEGER,
    "statisticsNote" TEXT,
    "imageUrl" TEXT,
    "imageSourceUrl" TEXT,
    "imageAuthor" TEXT,
    "imageLicense" TEXT,
    "imageAlt" TEXT,
    "hostCountryId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OlympicEdition_hostCountryId_fkey" FOREIGN KEY ("hostCountryId") REFERENCES "Country" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OlympicEdition" ("createdAt", "description", "endDate", "hostCity", "hostCountryId", "id", "name", "season", "slug", "startDate", "updatedAt", "year") SELECT "createdAt", "description", "endDate", "hostCity", "hostCountryId", "id", "name", "season", "slug", "startDate", "updatedAt", "year" FROM "OlympicEdition";
DROP TABLE "OlympicEdition";
ALTER TABLE "new_OlympicEdition" RENAME TO "OlympicEdition";
CREATE UNIQUE INDEX "OlympicEdition_slug_key" ON "OlympicEdition"("slug");
CREATE INDEX "OlympicEdition_hostCountryId_idx" ON "OlympicEdition"("hostCountryId");
CREATE INDEX "OlympicEdition_status_year_idx" ON "OlympicEdition"("status", "year");
CREATE INDEX "OlympicEdition_season_year_idx" ON "OlympicEdition"("season", "year");
CREATE UNIQUE INDEX "OlympicEdition_year_season_key" ON "OlympicEdition"("year", "season");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
