-- Add the minimum reference data needed to compare historical delegations.
INSERT INTO "Country" ("code", "name", "region", "historicalName", "activeFrom", "activeTo", "updatedAt")
VALUES ('URS', 'СССР', 'Европа и Азия', 'Союз Советских Социалистических Республик', 1922, 1991, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "NationalOlympicCommittee" ("code", "name", "shortName", "countryId", "historicalNote", "updatedAt")
SELECT 'URS', 'Олимпийская делегация СССР', 'СССР', "id",
  'Дебют делегации СССР на Олимпийских играх состоялся в Хельсинки в 1952 году.', CURRENT_TIMESTAMP
FROM "Country" WHERE "code" = 'URS'
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "NationalOlympicCommittee" ("code", "name", "shortName", "validFrom", "validTo", "historicalNote", "updatedAt")
VALUES ('EUN', 'Объединённая команда', 'Объединённая команда', 1992, 1992,
  'Спортсмены из бывших советских республик выступали в составе Объединённой команды в Альбервиле и Барселоне в 1992 году.',
  CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "KnowledgeSource" ("url", "title", "publisher", "accessedAt", "reliability", "updatedAt")
VALUES
  ('https://stillmed.olympics.com/media/Documents/Olympic-Games/Factsheets/The-Games-of-the-Olympiad.pdf',
   'The Games of the Olympiad', 'International Olympic Committee', CURRENT_TIMESTAMP, 'OFFICIAL', CURRENT_TIMESTAMP),
  ('https://library.olympics.com/digitalCollection/DigitalCollectionAttachmentDownloadHandler.ashx?documentId=3156133&parentDocumentId=3156131',
   'The Olympic Games: Late Twentieth Century (1976–1998)', 'Olympic Studies Centre',
   CURRENT_TIMESTAMP, 'OFFICIAL', CURRENT_TIMESTAMP),
  ('https://library.olympics.com/Default/digitalCollection/DigitalCollectionAttachmentDownloadHandler.ashx?documentId=160437',
   'London 2012 Olympic Games — Archery Media Guide', 'World Archery',
   CURRENT_TIMESTAMP, 'OFFICIAL', CURRENT_TIMESTAMP)
ON CONFLICT ("url") DO NOTHING;

INSERT INTO "FactCitation" ("sourceId", "entityType", "entityId", "fieldName", "note")
SELECT s."id", 'NationalOlympicCommittee', n."id", 'historicalNote', 'Подтверждает олимпийский дебют в Хельсинки в 1952 году.'
FROM "KnowledgeSource" s CROSS JOIN "NationalOlympicCommittee" n
WHERE n."code" = 'URS' AND s."url" = 'https://stillmed.olympics.com/media/Documents/Olympic-Games/Factsheets/The-Games-of-the-Olympiad.pdf'
ON CONFLICT DO NOTHING;

INSERT INTO "FactCitation" ("sourceId", "entityType", "entityId", "fieldName", "note")
SELECT s."id", 'NationalOlympicCommittee', n."id", 'historicalNote', 'Архивная справка об Объединённой команде на Играх 1992 года.'
FROM "KnowledgeSource" s CROSS JOIN "NationalOlympicCommittee" n
WHERE n."code" = 'EUN' AND s."url" = 'https://library.olympics.com/digitalCollection/DigitalCollectionAttachmentDownloadHandler.ashx?documentId=3156133&parentDocumentId=3156131'
ON CONFLICT DO NOTHING;

INSERT INTO "FactCitation" ("sourceId", "entityType", "entityId", "fieldName", "note")
SELECT s."id", 'NationalOlympicCommittee', n."id", 'code', 'Справочник указывает исторический код делегации.'
FROM "KnowledgeSource" s CROSS JOIN "NationalOlympicCommittee" n
WHERE n."code" IN ('URS', 'EUN')
  AND s."url" = 'https://library.olympics.com/Default/digitalCollection/DigitalCollectionAttachmentDownloadHandler.ashx?documentId=160437'
ON CONFLICT DO NOTHING;
