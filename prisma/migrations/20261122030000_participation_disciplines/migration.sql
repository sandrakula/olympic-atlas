CREATE TABLE "ParticipationDiscipline" (
    "participationId" INTEGER NOT NULL,
    "disciplineId" INTEGER NOT NULL,
    PRIMARY KEY ("participationId", "disciplineId"),
    CONSTRAINT "ParticipationDiscipline_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "Participation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ParticipationDiscipline_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ParticipationDiscipline_disciplineId_idx" ON "ParticipationDiscipline"("disciplineId");
