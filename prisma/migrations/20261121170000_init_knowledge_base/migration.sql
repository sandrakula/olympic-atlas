-- CreateTable
CREATE TABLE "OlympicEdition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "season" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "hostCity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hostCountryId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OlympicEdition_hostCountryId_fkey" FOREIGN KEY ("hostCountryId") REFERENCES "Country" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Country" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "historicalName" TEXT,
    "activeFrom" INTEGER,
    "activeTo" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NationalOlympicCommittee" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "countryId" INTEGER,
    "validFrom" INTEGER,
    "validTo" INTEGER,
    "historicalNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NationalOlympicCommittee_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Athlete" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "birthDate" DATETIME,
    "deathDate" DATETIME,
    "biography" TEXT NOT NULL,
    "countryId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Athlete_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Sport" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Discipline" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sportId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Discipline_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Event" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT,
    "editionId" INTEGER NOT NULL,
    "disciplineId" INTEGER NOT NULL,
    "venueId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Event_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "OlympicEdition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Event_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Event_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Participation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "athleteId" INTEGER NOT NULL,
    "editionId" INTEGER NOT NULL,
    "nocId" INTEGER NOT NULL,
    "sportId" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Participation_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Participation_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "OlympicEdition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Participation_nocId_fkey" FOREIGN KEY ("nocId") REFERENCES "NationalOlympicCommittee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Participation_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Team" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "editionId" INTEGER NOT NULL,
    "nocId" INTEGER NOT NULL,
    "eventId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Team_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "OlympicEdition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Team_nocId_fkey" FOREIGN KEY ("nocId") REFERENCES "NationalOlympicCommittee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Team_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "teamId" INTEGER NOT NULL,
    "athleteId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamMember_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MedalResult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "resultKey" TEXT NOT NULL,
    "medal" TEXT NOT NULL,
    "resultType" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "rank" INTEGER NOT NULL,
    "resultText" TEXT,
    "eventId" INTEGER NOT NULL,
    "athleteId" INTEGER,
    "teamId" INTEGER,
    "nocId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MedalResult_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MedalResult_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MedalResult_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MedalResult_nocId_fkey" FOREIGN KEY ("nocId") REFERENCES "NationalOlympicCommittee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "countryId" INTEGER,
    "editionId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Venue_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Venue_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "OlympicEdition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KnowledgeSource" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "publishedAt" DATETIME,
    "accessedAt" DATETIME NOT NULL,
    "reliability" TEXT NOT NULL DEFAULT 'UNREVIEWED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FactCitation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceId" INTEGER NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "fieldName" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FactCitation_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "KnowledgeSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "OlympicEdition_slug_key" ON "OlympicEdition"("slug");

-- CreateIndex
CREATE INDEX "OlympicEdition_hostCountryId_idx" ON "OlympicEdition"("hostCountryId");

-- CreateIndex
CREATE INDEX "OlympicEdition_season_year_idx" ON "OlympicEdition"("season", "year");

-- CreateIndex
CREATE UNIQUE INDEX "OlympicEdition_year_season_key" ON "OlympicEdition"("year", "season");

-- CreateIndex
CREATE UNIQUE INDEX "Country_code_key" ON "Country"("code");

-- CreateIndex
CREATE INDEX "Country_region_idx" ON "Country"("region");

-- CreateIndex
CREATE UNIQUE INDEX "NationalOlympicCommittee_code_key" ON "NationalOlympicCommittee"("code");

-- CreateIndex
CREATE INDEX "NationalOlympicCommittee_countryId_idx" ON "NationalOlympicCommittee"("countryId");

-- CreateIndex
CREATE INDEX "NationalOlympicCommittee_validFrom_validTo_idx" ON "NationalOlympicCommittee"("validFrom", "validTo");

-- CreateIndex
CREATE UNIQUE INDEX "Athlete_slug_key" ON "Athlete"("slug");

-- CreateIndex
CREATE INDEX "Athlete_countryId_idx" ON "Athlete"("countryId");

-- CreateIndex
CREATE INDEX "Athlete_fullName_idx" ON "Athlete"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "Sport_slug_key" ON "Sport"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Sport_name_key" ON "Sport"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Discipline_slug_key" ON "Discipline"("slug");

-- CreateIndex
CREATE INDEX "Discipline_sportId_idx" ON "Discipline"("sportId");

-- CreateIndex
CREATE UNIQUE INDEX "Discipline_sportId_name_key" ON "Discipline"("sportId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE INDEX "Event_editionId_idx" ON "Event"("editionId");

-- CreateIndex
CREATE INDEX "Event_disciplineId_idx" ON "Event"("disciplineId");

-- CreateIndex
CREATE INDEX "Event_venueId_idx" ON "Event"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_editionId_disciplineId_name_gender_key" ON "Event"("editionId", "disciplineId", "name", "gender");

-- CreateIndex
CREATE INDEX "Participation_editionId_nocId_idx" ON "Participation"("editionId", "nocId");

-- CreateIndex
CREATE INDEX "Participation_sportId_idx" ON "Participation"("sportId");

-- CreateIndex
CREATE UNIQUE INDEX "Participation_athleteId_editionId_nocId_sportId_key" ON "Participation"("athleteId", "editionId", "nocId", "sportId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_slug_key" ON "Team"("slug");

-- CreateIndex
CREATE INDEX "Team_eventId_idx" ON "Team"("eventId");

-- CreateIndex
CREATE INDEX "Team_nocId_idx" ON "Team"("nocId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_editionId_nocId_name_key" ON "Team"("editionId", "nocId", "name");

-- CreateIndex
CREATE INDEX "TeamMember_athleteId_idx" ON "TeamMember"("athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_athleteId_key" ON "TeamMember"("teamId", "athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "MedalResult_resultKey_key" ON "MedalResult"("resultKey");

-- CreateIndex
CREATE INDEX "MedalResult_eventId_medal_idx" ON "MedalResult"("eventId", "medal");

-- CreateIndex
CREATE INDEX "MedalResult_athleteId_idx" ON "MedalResult"("athleteId");

-- CreateIndex
CREATE INDEX "MedalResult_teamId_idx" ON "MedalResult"("teamId");

-- CreateIndex
CREATE INDEX "MedalResult_nocId_idx" ON "MedalResult"("nocId");

-- CreateIndex
CREATE INDEX "Venue_countryId_idx" ON "Venue"("countryId");

-- CreateIndex
CREATE INDEX "Venue_editionId_idx" ON "Venue"("editionId");

-- CreateIndex
CREATE UNIQUE INDEX "Venue_editionId_name_key" ON "Venue"("editionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeSource_url_key" ON "KnowledgeSource"("url");

-- CreateIndex
CREATE INDEX "FactCitation_entityType_entityId_idx" ON "FactCitation"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "FactCitation_sourceId_entityType_entityId_fieldName_key" ON "FactCitation"("sourceId", "entityType", "entityId", "fieldName");
