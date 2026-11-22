-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Athlete" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "alternateNames" TEXT NOT NULL DEFAULT '[]',
    "birthDate" DATETIME,
    "deathDate" DATETIME,
    "birthPlace" TEXT,
    "gender" TEXT,
    "biography" TEXT NOT NULL,
    "specialty" TEXT,
    "wikidataId" TEXT,
    "olympicsId" TEXT,
    "externalIds" TEXT NOT NULL DEFAULT '{}',
    "imageUrl" TEXT,
    "imageSourceUrl" TEXT,
    "imageAuthor" TEXT,
    "imageLicense" TEXT,
    "imageLicenseUrl" TEXT,
    "imageAlt" TEXT,
    "dataStatus" TEXT NOT NULL DEFAULT 'BASIC',
    "countryId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Athlete_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Athlete" ("biography", "birthDate", "countryId", "createdAt", "deathDate", "fullName", "id", "slug", "updatedAt") SELECT "biography", "birthDate", "countryId", "createdAt", "deathDate", "fullName", "id", "slug", "updatedAt" FROM "Athlete";
DROP TABLE "Athlete";
ALTER TABLE "new_Athlete" RENAME TO "Athlete";
CREATE UNIQUE INDEX "Athlete_slug_key" ON "Athlete"("slug");
CREATE UNIQUE INDEX "Athlete_wikidataId_key" ON "Athlete"("wikidataId");
CREATE UNIQUE INDEX "Athlete_olympicsId_key" ON "Athlete"("olympicsId");
CREATE INDEX "Athlete_countryId_idx" ON "Athlete"("countryId");
CREATE INDEX "Athlete_fullName_idx" ON "Athlete"("fullName");
CREATE INDEX "Athlete_dataStatus_idx" ON "Athlete"("dataStatus");
CREATE INDEX "Athlete_birthDate_idx" ON "Athlete"("birthDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
