-- Derived search index. The domain tables remain the source of facts.
BEGIN;
CREATE VIRTUAL TABLE AtlasSearch USING fts5(
  kind UNINDEXED, entityId UNINDEXED, title, aliases, body,
  tokenize='unicode61 remove_diacritics 2', prefix='2 3 4'
);

INSERT INTO AtlasSearch(rowid, kind, entityId, title, aliases, body)
  SELECT id * 16 + 1, 'Athlete', id, fullName, coalesce(alternateNames,'') || ' ' || slug || ' ' || coalesce(wikidataId,''), biography || ' ' || coalesce(specialty,'') || ' ' || coalesce(birthPlace,'') FROM "Athlete";
CREATE TRIGGER atlas_search_1_insert AFTER INSERT ON "Athlete" BEGIN
  INSERT INTO AtlasSearch(rowid, kind, entityId, title, aliases, body) VALUES (NEW.id * 16 + 1, 'Athlete', NEW.id, NEW.fullName, coalesce(NEW.alternateNames,'') || ' ' || NEW.slug || ' ' || coalesce(NEW.wikidataId,''), NEW.biography || ' ' || coalesce(NEW.specialty,'') || ' ' || coalesce(NEW.birthPlace,''));
END;
CREATE TRIGGER atlas_search_1_update AFTER UPDATE OF id, fullName, alternateNames, slug, wikidataId, biography, specialty, birthPlace ON "Athlete" BEGIN
  DELETE FROM AtlasSearch WHERE rowid = OLD.id * 16 + 1;
  INSERT INTO AtlasSearch(rowid, kind, entityId, title, aliases, body) VALUES (NEW.id * 16 + 1, 'Athlete', NEW.id, NEW.fullName, coalesce(NEW.alternateNames,'') || ' ' || NEW.slug || ' ' || coalesce(NEW.wikidataId,''), NEW.biography || ' ' || coalesce(NEW.specialty,'') || ' ' || coalesce(NEW.birthPlace,''));
END;
CREATE TRIGGER atlas_search_1_delete AFTER DELETE ON "Athlete" BEGIN
  DELETE FROM AtlasSearch WHERE rowid = OLD.id * 16 + 1;
END;

INSERT INTO AtlasSearch(rowid, kind, entityId, title, aliases, body)
  SELECT id * 16 + 2, 'OlympicEdition', id, hostCity, hostCity || ' ' || year || ' ' || slug, name || ' ' || description || ' ' || coalesce(historicalNote,'') FROM "OlympicEdition";
CREATE TRIGGER atlas_search_2_insert AFTER INSERT ON "OlympicEdition" BEGIN
  INSERT INTO AtlasSearch(rowid, kind, entityId, title, aliases, body) VALUES (NEW.id * 16 + 2, 'OlympicEdition', NEW.id, NEW.hostCity, NEW.hostCity || ' ' || NEW.year || ' ' || NEW.slug, NEW.name || ' ' || NEW.description || ' ' || coalesce(NEW.historicalNote,''));
END;
CREATE TRIGGER atlas_search_2_update AFTER UPDATE OF id, hostCity, year, slug, name, description, historicalNote ON "OlympicEdition" BEGIN
  DELETE FROM AtlasSearch WHERE rowid = OLD.id * 16 + 2;
  INSERT INTO AtlasSearch(rowid, kind, entityId, title, aliases, body) VALUES (NEW.id * 16 + 2, 'OlympicEdition', NEW.id, NEW.hostCity, NEW.hostCity || ' ' || NEW.year || ' ' || NEW.slug, NEW.name || ' ' || NEW.description || ' ' || coalesce(NEW.historicalNote,''));
END;
CREATE TRIGGER atlas_search_2_delete AFTER DELETE ON "OlympicEdition" BEGIN
  DELETE FROM AtlasSearch WHERE rowid = OLD.id * 16 + 2;
END;

INSERT INTO AtlasSearch(rowid, kind, entityId, title, aliases, body)
  SELECT id * 16 + 3, 'Country', id, name, code || ' ' || coalesce(historicalName,''), region FROM "Country";
CREATE TRIGGER atlas_search_3_insert AFTER INSERT ON "Country" BEGIN
  INSERT INTO AtlasSearch(rowid, kind, entityId, title, aliases, body) VALUES (NEW.id * 16 + 3, 'Country', NEW.id, NEW.name, NEW.code || ' ' || coalesce(NEW.historicalName,''), NEW.region);
END;
CREATE TRIGGER atlas_search_3_update AFTER UPDATE OF id, name, code, historicalName, region ON "Country" BEGIN
  DELETE FROM AtlasSearch WHERE rowid = OLD.id * 16 + 3;
  INSERT INTO AtlasSearch(rowid, kind, entityId, title, aliases, body) VALUES (NEW.id * 16 + 3, 'Country', NEW.id, NEW.name, NEW.code || ' ' || coalesce(NEW.historicalName,''), NEW.region);
END;
CREATE TRIGGER atlas_search_3_delete AFTER DELETE ON "Country" BEGIN
  DELETE FROM AtlasSearch WHERE rowid = OLD.id * 16 + 3;
END;

INSERT INTO AtlasSearch(rowid, kind, entityId, title, aliases, body)
  SELECT id * 16 + 4, 'NationalOlympicCommittee', id, name, code || ' ' || coalesce(shortName,''), coalesce(historicalNote,'') FROM "NationalOlympicCommittee";
CREATE TRIGGER atlas_search_4_insert AFTER INSERT ON "NationalOlympicCommittee" BEGIN
  INSERT INTO AtlasSearch(rowid, kind, entityId, title, aliases, body) VALUES (NEW.id * 16 + 4, 'NationalOlympicCommittee', NEW.id, NEW.name, NEW.code || ' ' || coalesce(NEW.shortName,''), coalesce(NEW.historicalNote,''));
END;
CREATE TRIGGER atlas_search_4_update AFTER UPDATE OF id, name, code, shortName, historicalNote ON "NationalOlympicCommittee" BEGIN
  DELETE FROM AtlasSearch WHERE rowid = OLD.id * 16 + 4;
  INSERT INTO AtlasSearch(rowid, kind, entityId, title, aliases, body) VALUES (NEW.id * 16 + 4, 'NationalOlympicCommittee', NEW.id, NEW.name, NEW.code || ' ' || coalesce(NEW.shortName,''), coalesce(NEW.historicalNote,''));
END;
CREATE TRIGGER atlas_search_4_delete AFTER DELETE ON "NationalOlympicCommittee" BEGIN
  DELETE FROM AtlasSearch WHERE rowid = OLD.id * 16 + 4;
END;

INSERT INTO AtlasSearch(rowid, kind, entityId, title, aliases, body)
  SELECT id * 16 + 5, 'Sport', id, name, slug, description FROM "Sport";
CREATE TRIGGER atlas_search_5_insert AFTER INSERT ON "Sport" BEGIN
  INSERT INTO AtlasSearch(rowid, kind, entityId, title, aliases, body) VALUES (NEW.id * 16 + 5, 'Sport', NEW.id, NEW.name, NEW.slug, NEW.description);
END;
CREATE TRIGGER atlas_search_5_update AFTER UPDATE OF id, name, slug, description ON "Sport" BEGIN
  DELETE FROM AtlasSearch WHERE rowid = OLD.id * 16 + 5;
  INSERT INTO AtlasSearch(rowid, kind, entityId, title, aliases, body) VALUES (NEW.id * 16 + 5, 'Sport', NEW.id, NEW.name, NEW.slug, NEW.description);
END;
CREATE TRIGGER atlas_search_5_delete AFTER DELETE ON "Sport" BEGIN
  DELETE FROM AtlasSearch WHERE rowid = OLD.id * 16 + 5;
END;

INSERT INTO AtlasSearch(rowid, kind, entityId, title, aliases, body)
  SELECT id * 16 + 6, 'Discipline', id, name, slug, '' FROM "Discipline";
CREATE TRIGGER atlas_search_6_insert AFTER INSERT ON "Discipline" BEGIN
  INSERT INTO AtlasSearch(rowid, kind, entityId, title, aliases, body) VALUES (NEW.id * 16 + 6, 'Discipline', NEW.id, NEW.name, NEW.slug, '');
END;
CREATE TRIGGER atlas_search_6_update AFTER UPDATE OF id, name, slug ON "Discipline" BEGIN
  DELETE FROM AtlasSearch WHERE rowid = OLD.id * 16 + 6;
  INSERT INTO AtlasSearch(rowid, kind, entityId, title, aliases, body) VALUES (NEW.id * 16 + 6, 'Discipline', NEW.id, NEW.name, NEW.slug, '');
END;
CREATE TRIGGER atlas_search_6_delete AFTER DELETE ON "Discipline" BEGIN
  DELETE FROM AtlasSearch WHERE rowid = OLD.id * 16 + 6;
END;

INSERT INTO AtlasSearch(rowid, kind, entityId, title, aliases, body)
  SELECT id * 16 + 7, 'Event', id, name, slug, coalesce(gender,'') FROM "Event";
CREATE TRIGGER atlas_search_7_insert AFTER INSERT ON "Event" BEGIN
  INSERT INTO AtlasSearch(rowid, kind, entityId, title, aliases, body) VALUES (NEW.id * 16 + 7, 'Event', NEW.id, NEW.name, NEW.slug, coalesce(NEW.gender,''));
END;
CREATE TRIGGER atlas_search_7_update AFTER UPDATE OF id, name, slug, gender ON "Event" BEGIN
  DELETE FROM AtlasSearch WHERE rowid = OLD.id * 16 + 7;
  INSERT INTO AtlasSearch(rowid, kind, entityId, title, aliases, body) VALUES (NEW.id * 16 + 7, 'Event', NEW.id, NEW.name, NEW.slug, coalesce(NEW.gender,''));
END;
CREATE TRIGGER atlas_search_7_delete AFTER DELETE ON "Event" BEGIN
  DELETE FROM AtlasSearch WHERE rowid = OLD.id * 16 + 7;
END;

INSERT INTO AtlasSearch(rowid, kind, entityId, title, aliases, body)
  SELECT id * 16 + 8, 'KnowledgeSource', id, title, publisher, '' FROM "KnowledgeSource";
CREATE TRIGGER atlas_search_8_insert AFTER INSERT ON "KnowledgeSource" BEGIN
  INSERT INTO AtlasSearch(rowid, kind, entityId, title, aliases, body) VALUES (NEW.id * 16 + 8, 'KnowledgeSource', NEW.id, NEW.title, NEW.publisher, '');
END;
CREATE TRIGGER atlas_search_8_update AFTER UPDATE OF id, title, publisher ON "KnowledgeSource" BEGIN
  DELETE FROM AtlasSearch WHERE rowid = OLD.id * 16 + 8;
  INSERT INTO AtlasSearch(rowid, kind, entityId, title, aliases, body) VALUES (NEW.id * 16 + 8, 'KnowledgeSource', NEW.id, NEW.title, NEW.publisher, '');
END;
CREATE TRIGGER atlas_search_8_delete AFTER DELETE ON "KnowledgeSource" BEGIN
  DELETE FROM AtlasSearch WHERE rowid = OLD.id * 16 + 8;
END;

COMMIT;
