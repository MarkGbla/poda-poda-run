-- Legacy anonymous runs remain in the original tables and never become ranked account data.
CREATE TABLE players (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  driver_name TEXT,
  name_key TEXT UNIQUE,
  name_changed_at INTEGER,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER NOT NULL
);
CREATE TABLE app_sessions (
  token_hash TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX app_sessions_expiry ON app_sessions(expires_at);
CREATE INDEX app_sessions_player ON app_sessions(player_id);
CREATE TABLE oauth_attempts (
  state_hash TEXT PRIMARY KEY,
  browser_hash TEXT NOT NULL,
  verifier TEXT NOT NULL,
  nonce TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX oauth_attempts_expiry ON oauth_attempts(expires_at);
CREATE TABLE player_progress (
  player_id TEXT PRIMARY KEY REFERENCES players(id),
  preferences_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE TABLE account_run_sessions (
  run_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  request_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  route_id TEXT NOT NULL,
  ruleset TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  finished_at INTEGER,
  UNIQUE(player_id, request_id)
);
CREATE INDEX account_runs_player_time ON account_run_sessions(player_id, started_at);
CREATE TABLE accepted_runs (
  run_id TEXT PRIMARY KEY REFERENCES account_run_sessions(run_id),
  player_id TEXT NOT NULL REFERENCES players(id),
  score INTEGER NOT NULL CHECK(score >= 0),
  earnings INTEGER NOT NULL CHECK(earnings >= 0),
  distance INTEGER NOT NULL CHECK(distance >= 0),
  duration_ms INTEGER NOT NULL CHECK(duration_ms >= 0),
  passengers INTEGER NOT NULL CHECK(passengers >= 0),
  perfect_stops INTEGER NOT NULL CHECK(perfect_stops >= 0),
  completed INTEGER NOT NULL CHECK(completed IN (0,1)),
  summary_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  accepted_at INTEGER NOT NULL
);
CREATE INDEX accepted_runs_player_time ON accepted_runs(player_id, accepted_at);
CREATE TABLE player_stats (
  player_id TEXT PRIMARY KEY REFERENCES players(id),
  best_score INTEGER NOT NULL DEFAULT 0,
  best_at INTEGER NOT NULL,
  lifetime_earnings INTEGER NOT NULL DEFAULT 0,
  earnings_at INTEGER NOT NULL,
  total_runs INTEGER NOT NULL DEFAULT 0,
  completed_runs INTEGER NOT NULL DEFAULT 0,
  total_distance INTEGER NOT NULL DEFAULT 0,
  total_duration_ms INTEGER NOT NULL DEFAULT 0,
  total_passengers INTEGER NOT NULL DEFAULT 0,
  perfect_stops INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX stats_best ON player_stats(best_score DESC, best_at, player_id);
CREATE INDEX stats_earnings ON player_stats(lifetime_earnings DESC, earnings_at, player_id);
CREATE TABLE period_bests (
  period TEXT NOT NULL CHECK(period IN ('today','week')),
  starts_at INTEGER NOT NULL,
  player_id TEXT NOT NULL REFERENCES players(id),
  score INTEGER NOT NULL,
  achieved_at INTEGER NOT NULL,
  run_id TEXT NOT NULL REFERENCES accepted_runs(run_id),
  PRIMARY KEY(period, starts_at, player_id)
);
CREATE INDEX period_ranking ON period_bests(period, starts_at, score DESC, achieved_at, player_id);
