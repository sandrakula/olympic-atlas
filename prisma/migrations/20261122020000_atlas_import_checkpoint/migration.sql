CREATE TABLE "AtlasImportCheckpoint" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "sourceDigest" TEXT NOT NULL,
    "cursor" INTEGER NOT NULL DEFAULT 0
);
