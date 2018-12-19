
CREATE TABLE db_schema (
  ver  INTEGER PRIMARY KEY,
  up   TEXT NOT NULL,
  down TEXT NOT NULL
);

CREATE TABLE db_schema_log (
  id   INTEGER PRIMARY KEY,
  time INTEGER default (CAST(((julianday('now') - 2440587.5)*86400000) as INTEGER)),
  ver  INTEGER
);

-- Down

DROP TABLE db_schema;
DROP TABLE db_schema_log;

