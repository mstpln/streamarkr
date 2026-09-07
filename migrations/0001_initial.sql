PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS titles (
  id TEXT PRIMARY KEY,
  media_type TEXT NOT NULL CHECK (media_type IN ('series', 'movie')),
  tmdb_id INTEGER NOT NULL,
  trakt_id INTEGER,
  imdb_id TEXT,
  availability_id TEXT,
  title TEXT NOT NULL,
  year INTEGER NOT NULL,
  UNIQUE (media_type, tmdb_id),
  CHECK (id = media_type || '-' || CAST(tmdb_id AS TEXT))
);
CREATE INDEX IF NOT EXISTS idx_titles_tmdb ON titles(media_type, tmdb_id);
CREATE INDEX IF NOT EXISTS idx_titles_name ON titles(title COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS title_metadata (
  title_id TEXT PRIMARY KEY REFERENCES titles(id) ON DELETE RESTRICT,
  status TEXT NOT NULL,
  overview TEXT NOT NULL DEFAULT '',
  genres_json TEXT NOT NULL DEFAULT '[]',
  poster_path TEXT NOT NULL DEFAULT '',
  backdrop_path TEXT NOT NULL DEFAULT '',
  trailer_key TEXT,
  release_date TEXT,
  metadata_updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_title_metadata_status ON title_metadata(status);
CREATE INDEX IF NOT EXISTS idx_title_metadata_updated ON title_metadata(metadata_updated_at);

CREATE TABLE IF NOT EXISTS seasons (
  title_id TEXT NOT NULL REFERENCES titles(id) ON DELETE RESTRICT,
  season_number INTEGER NOT NULL,
  tmdb_season_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  episode_count INTEGER NOT NULL DEFAULT 0,
  air_date TEXT,
  PRIMARY KEY (title_id, season_number)
);
CREATE INDEX IF NOT EXISTS idx_seasons_air_date ON seasons(air_date);

CREATE TABLE IF NOT EXISTS episodes (
  title_id TEXT NOT NULL,
  season_number INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  tmdb_episode_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  runtime INTEGER,
  air_date TEXT,
  overview TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (title_id, season_number, episode_number),
  FOREIGN KEY (title_id, season_number) REFERENCES seasons(title_id, season_number) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_episodes_tmdb ON episodes(tmdb_episode_id);
CREATE INDEX IF NOT EXISTS idx_episodes_release ON episodes(title_id, air_date);

CREATE TABLE IF NOT EXISTS watch_events (
  provider_event_id TEXT PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  title_id TEXT NOT NULL REFERENCES titles(id) ON DELETE RESTRICT,
  season_number INTEGER,
  episode_number INTEGER,
  watched_at TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source = 'trakt')
);
CREATE INDEX IF NOT EXISTS idx_watch_events_title_time ON watch_events(title_id, watched_at DESC);

CREATE TABLE IF NOT EXISTS watch_overrides (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('movie', 'episode', 'season')),
  title_id TEXT NOT NULL REFERENCES titles(id) ON DELETE RESTRICT,
  season_number INTEGER,
  episode_number INTEGER,
  state TEXT NOT NULL CHECK (state IN ('watched', 'unwatched')),
  changed_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_watch_overrides_scope
  ON watch_overrides(scope_type, title_id, IFNULL(season_number, -1), IFNULL(episode_number, -1));
CREATE INDEX IF NOT EXISTS idx_watch_overrides_title ON watch_overrides(title_id);

CREATE TABLE IF NOT EXISTS library_items (
  title_id TEXT PRIMARY KEY REFERENCES titles(id) ON DELETE RESTRICT,
  added_at TEXT NOT NULL,
  derived_status TEXT NOT NULL CHECK (derived_status IN ('To Watch', 'Watching', 'On Hold', 'Caught Up', 'Finished')),
  status_computed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_library_status ON library_items(derived_status);
CREATE INDEX IF NOT EXISTS idx_library_added ON library_items(added_at DESC);

CREATE TABLE IF NOT EXISTS ratings (
  title_id TEXT PRIMARY KEY REFERENCES titles(id) ON DELETE RESTRICT,
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  rated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ratings_stars ON ratings(stars DESC, rated_at DESC);

CREATE TABLE IF NOT EXISTS services (
  service_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  logo_ref TEXT NOT NULL,
  user_selected INTEGER NOT NULL DEFAULT 0 CHECK (user_selected IN (0, 1)),
  availability_source TEXT NOT NULL CHECK (availability_source IN ('streaming-availability', 'tmdb-fallback', 'unsupported')),
  subscription_catalog_key TEXT
);

CREATE TABLE IF NOT EXISTS watched_service (
  title_id TEXT PRIMARY KEY REFERENCES titles(id) ON DELETE RESTRICT,
  service_key TEXT NOT NULL REFERENCES services(service_key) ON DELETE RESTRICT,
  changed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_watched_service_key ON watched_service(service_key);

CREATE TABLE IF NOT EXISTS availability (
  title_id TEXT NOT NULL REFERENCES titles(id) ON DELETE RESTRICT,
  service_key TEXT NOT NULL REFERENCES services(service_key) ON DELETE RESTRICT,
  option_type TEXT NOT NULL CHECK (option_type IN ('subscription', 'rent', 'buy')),
  deep_link TEXT,
  starts_at TEXT,
  ends_at TEXT,
  checked_at TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('streaming-availability', 'tmdb-fallback')),
  PRIMARY KEY (title_id, service_key, option_type)
);
CREATE INDEX IF NOT EXISTS idx_availability_service ON availability(service_key, option_type, title_id);
CREATE INDEX IF NOT EXISTS idx_availability_title ON availability(title_id, option_type);
CREATE INDEX IF NOT EXISTS idx_availability_ends ON availability(ends_at);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  title_id TEXT NOT NULL REFERENCES titles(id) ON DELETE RESTRICT,
  alert_type TEXT NOT NULL,
  message TEXT NOT NULL,
  event_date TEXT,
  created_at TEXT NOT NULL,
  seen_at TEXT,
  dedupe_key TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_unseen ON alerts(seen_at, created_at DESC);

CREATE TABLE IF NOT EXISTS provider_connections (
  provider TEXT PRIMARY KEY,
  encrypted_token_blob TEXT NOT NULL,
  connected_at TEXT NOT NULL,
  last_success_at TEXT,
  last_error_code TEXT
);

CREATE TABLE IF NOT EXISTS sync_state (
  sync_type TEXT PRIMARY KEY CHECK (sync_type IN ('trakt', 'metadata', 'availability')),
  cursor TEXT,
  last_attempt_at TEXT,
  last_success_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS recommendation_cache (
  mode TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('series', 'movie')),
  seed_key TEXT NOT NULL,
  results_json TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  PRIMARY KEY (mode, media_type, seed_key)
);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO app_meta(key, value) VALUES ('schema_version', '1');

INSERT OR IGNORE INTO services(service_key, display_name, logo_ref, user_selected, availability_source, subscription_catalog_key) VALUES
  ('netflix', 'Netflix', 'N', 0, 'streaming-availability', 'netflix'),
  ('hbo-max', 'HBO Max', 'MAX', 0, 'streaming-availability', 'hbo'),
  ('disney-plus', 'Disney+', 'D+', 0, 'streaming-availability', 'disney'),
  ('prime-video', 'Prime Video', 'P', 0, 'streaming-availability', 'prime'),
  ('skyshowtime', 'SkyShowtime', 'SKY', 0, 'streaming-availability', 'skyshowtime'),
  ('apple-tv', 'Apple TV', 'TV', 0, 'streaming-availability', 'apple'),
  ('viaplay', 'Viaplay', 'V', 0, 'unsupported', NULL),
  ('tv4-play', 'TV4 Play', '4', 0, 'unsupported', NULL);
