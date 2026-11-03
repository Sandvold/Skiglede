-- Skiglede: Neon (Postgres 17, eu-central-1) – prosjekt "skiglede"
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE trails (
  id bigserial PRIMARY KEY, name text NOT NULL, source text NOT NULL, source_ref text,
  geom geometry(LineString,4326) NOT NULL, length_m double precision,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (source, source_ref));
CREATE INDEX trails_geom_idx ON trails USING gist (geom);

CREATE TABLE trail_sections (
  id bigserial PRIMARY KEY, trail_id bigint NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  seq int NOT NULL, geom geometry(LineString,4326) NOT NULL,
  start_m double precision, end_m double precision, elev_start_m real, elev_end_m real,
  aspect_deg real, slope_deg real, forest_fraction real, UNIQUE (trail_id, seq));

-- Timesverdier fra MET Nordic per 1 km-rute (i,j)
CREATE TABLE weather_hours (
  cell_i int NOT NULL, cell_j int NOT NULL, ts timestamptz NOT NULL,
  temp_c real, precip_mm real, rh real, wind_ms real, sw_j_m2 real,
  source text NOT NULL DEFAULT 'metnordic', PRIMARY KEY (cell_i, cell_j, ts));
