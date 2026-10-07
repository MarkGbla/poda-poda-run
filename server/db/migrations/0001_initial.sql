CREATE TABLE run_sessions (
  run_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  started_at_ms INTEGER NOT NULL,
  finished_at_ms INTEGER
);

CREATE TABLE runs (
  run_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  player_name TEXT,
  score INTEGER NOT NULL,
  earnings INTEGER NOT NULL,
  coins INTEGER NOT NULL,
  passengers INTEGER NOT NULL,
  distance INTEGER NOT NULL,
  stops INTEGER NOT NULL,
  perfect_stops INTEGER NOT NULL,
  missed_stops INTEGER NOT NULL,
  collisions INTEGER NOT NULL,
  completed INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  game_version TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL
);

CREATE INDEX runs_created_score ON runs(created_at_ms, score DESC);
CREATE INDEX runs_player_score ON runs(player_id, score DESC);
CREATE INDEX runs_score_created ON runs(score DESC, created_at_ms);
