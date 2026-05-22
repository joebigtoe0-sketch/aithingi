CREATE TABLE IF NOT EXISTS log_entries (
  id TEXT PRIMARY KEY,
  ts BIGINT NOT NULL,
  src TEXT NOT NULL,
  tag TEXT NOT NULL,
  msg TEXT NOT NULL,
  public BOOLEAN NOT NULL DEFAULT true,
  redacted BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS log_entries_ts_idx ON log_entries (ts DESC);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  codename TEXT NOT NULL,
  ticker TEXT,
  status TEXT NOT NULL,
  launched BIGINT,
  wallet TEXT,
  balance DOUBLE PRECISION,
  market_cap BIGINT,
  holders INT,
  thesis TEXT,
  subagents JSONB NOT NULL DEFAULT '[]',
  pumpfun TEXT,
  token_id TEXT,
  dev_id TEXT,
  token_image TEXT,
  dev_image TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
