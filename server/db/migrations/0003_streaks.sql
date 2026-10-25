CREATE TABLE player_streaks (
  player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL CHECK(current_streak >= 1),
  longest_streak INTEGER NOT NULL CHECK(longest_streak >= current_streak),
  last_qualified_date TEXT NOT NULL,
  streak_started_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
-- Receipts must survive midnight so a replay never qualifies another day.
CREATE TABLE player_streak_events (
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  qualified_date TEXT NOT NULL,
  PRIMARY KEY (player_id, event_id)
);
