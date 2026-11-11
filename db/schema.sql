-- Skiglede: Neon (Postgres 17, eu-central-1), prosjekt nameless-brook-61667562.
-- GJELDENDE SKJEMA, lest ut fra den levende databasen 11. nov 2026 (tabeller, nøkler, RLS-policyer og egne funksjoner).
-- Dette er dokumentasjon av hva som kjører, ikke en migrering som er testet fra scratch. Endringer gjøres i databasen
-- og denne filen oppdateres etterpå. Roller: anonymous (ikke innlogget), authenticated (innlogget), vaer_skriver (værjobben, GitHub Actions).
-- Rader per bruker bruker `user_id text default auth.user_id()` og RLS med `user_id = auth.user_id()`.

CREATE EXTENSION IF NOT EXISTS postgis;

-- ============ Områder, løyper og vær (leses av alle, skrives av vaer_skriver) ============

CREATE TABLE omrade (
  id text PRIMARY KEY, navn text NOT NULL, lat double precision NOT NULL, lon double precision NOT NULL,
  vis_lon double precision NOT NULL, vis_lat double precision NOT NULL, vis_z real NOT NULL DEFAULT 11,
  vinter_min real NOT NULL, vinter_max real NOT NULL,
  ref_hoyde_m real NOT NULL,                 -- snitthøyde av løypene; reservehøyde for vær hvis MET-cellens høyde ikke finnes
  loypefil text, vaer boolean NOT NULL DEFAULT true, rekkefolge integer NOT NULL DEFAULT 100,
  oppdatert timestamptz NOT NULL DEFAULT now());

CREATE TABLE loype (
  omrade text NOT NULL, id text NOT NULL, navn text NOT NULL, type text, lengde_m real NOT NULL, variant_av text,
  start jsonb NOT NULL, oversikt jsonb NOT NULL, data jsonb NOT NULL,
  oppdatert timestamptz NOT NULL DEFAULT now(), innhold_hash text,
  PRIMARY KEY (omrade, id));

-- Værhistorikk per område: opptil 14 døgn fra MET Nordic, oppdatert hver fjerde time av værjobben (scripts/oppdater_vaer.py).
-- referansehoyde_m er høyden til MET-cellen (dit temperaturene hører hjemme), ikke løypenes snitthøyde.
CREATE TABLE vaer (
  omrade text PRIMARY KEY, referansehoyde_m real NOT NULL, celle integer[] NOT NULL, kolonner text[] NOT NULL,
  timer jsonb NOT NULL,                      -- rader: [ts, temp_c, nedbor_mm, rh, vind_ms, sw_j_m2]
  oppdatert timestamptz NOT NULL DEFAULT now());

-- ============ Brukerdata (bare eieren, via RLS) ============

CREATE TABLE profil (
  user_id text PRIMARY KEY DEFAULT auth.user_id(), premium boolean NOT NULL DEFAULT false, pro boolean NOT NULL DEFAULT false,
  opprettet timestamptz NOT NULL DEFAULT now(), oppdatert timestamptz NOT NULL DEFAULT now());

-- Synk av lager, skipark, valgte ski, steder m.m. for premium (nøkler `skiglede.*`, se src/data/lagring.ts)
CREATE TABLE brukerdata (
  user_id text NOT NULL DEFAULT auth.user_id(), nokkel text NOT NULL, verdi jsonb NOT NULL,
  oppdatert timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, nokkel));

CREATE TABLE smoring_logg (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL DEFAULT auth.user_id(),
  tid timestamptz NOT NULL DEFAULT now(), omrade text, loype_id text, loype_navn text, stil text, ski_navn text,
  produkter jsonb, modell jsonb, grep smallint, glid smallint, snotemp_malt real, lufttemp_malt real, kommentar text,
  opprettet timestamptz NOT NULL DEFAULT now());

CREATE TABLE bruker_rute (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL DEFAULT auth.user_id(), navn text NOT NULL,
  lengde_m real, punkter jsonb NOT NULL, start_lat double precision, start_lon double precision, stil text,
  opprettet timestamptz NOT NULL DEFAULT now(), delt boolean NOT NULL DEFAULT false, terreng jsonb);

CREATE TABLE rute_vaer (
  rute_id uuid PRIMARY KEY REFERENCES bruker_rute(id) ON DELETE CASCADE, referansehoyde_m real, celle integer[], kolonner text[],
  timer jsonb NOT NULL, oppdatert timestamptz NOT NULL DEFAULT now());

-- ============ Renn (pro) og admin ============

CREATE TABLE admin (user_id text PRIMARY KEY);

CREATE TABLE konkurranse (
  id text PRIMARY KEY, navn text NOT NULL, omrade text REFERENCES omrade(id), dato date, starttid time, stil text,
  lengde_km real, loype_id text, gpx_kilde text, testdata boolean NOT NULL DEFAULT true, merknad text,
  oppdatert timestamptz NOT NULL DEFAULT now());

CREATE TABLE renn_rute (
  renn_id text PRIMARY KEY REFERENCES konkurranse(id) ON DELETE CASCADE, lengde_m real NOT NULL, punkter jsonb NOT NULL, terreng jsonb,
  start_lat double precision NOT NULL, start_lon double precision NOT NULL, oppdatert timestamptz NOT NULL DEFAULT now());

-- ============ Eldre tabeller (fra første prototype, brukes ikke av appen) ============

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

CREATE TABLE weather_hours (
  cell_i int NOT NULL, cell_j int NOT NULL, ts timestamptz NOT NULL,
  temp_c real, precip_mm real, rh real, wind_ms real, sw_j_m2 real,
  source text NOT NULL DEFAULT 'metnordic', PRIMARY KEY (cell_i, cell_j, ts));

-- ============ RLS-policyer (alle tabeller over har RLS på) ============

-- Åpent for lesing (anonymous og authenticated)
CREATE POLICY omrade_les ON omrade FOR SELECT TO anonymous, authenticated USING (true);
CREATE POLICY loype_les ON loype FOR SELECT TO anonymous, authenticated USING (true);
CREATE POLICY vaer_les ON vaer FOR SELECT TO anonymous, authenticated USING (true);
CREATE POLICY konkurranse_les ON konkurranse FOR SELECT TO anonymous, authenticated USING (true);

-- Værjobben (vaer_skriver) skriver områder, løyper, vær og rutevær
CREATE POLICY omrade_skriv ON omrade FOR ALL TO vaer_skriver USING (true) WITH CHECK (true);
CREATE POLICY loype_skriv ON loype FOR ALL TO vaer_skriver USING (true) WITH CHECK (true);
CREATE POLICY vaer_skriv ON vaer FOR ALL TO vaer_skriver USING (true) WITH CHECK (true);
CREATE POLICY rute_vaer_skriver ON rute_vaer FOR ALL TO vaer_skriver USING (true) WITH CHECK (true);

-- Egne rader
CREATE POLICY profil_egen ON profil FOR ALL TO authenticated USING (user_id = auth.user_id()) WITH CHECK (user_id = auth.user_id());
CREATE POLICY brukerdata_egen ON brukerdata FOR ALL TO authenticated USING (user_id = auth.user_id()) WITH CHECK (user_id = auth.user_id());
CREATE POLICY logg_les ON smoring_logg FOR SELECT TO authenticated USING (user_id = auth.user_id());
CREATE POLICY logg_endre ON smoring_logg FOR UPDATE TO authenticated USING (user_id = auth.user_id()) WITH CHECK (user_id = auth.user_id());
CREATE POLICY logg_slett ON smoring_logg FOR DELETE TO authenticated USING (user_id = auth.user_id());
CREATE POLICY logg_ny ON smoring_logg FOR INSERT TO authenticated  -- bare premium kan logge
  WITH CHECK (user_id = auth.user_id() AND EXISTS (SELECT 1 FROM profil p WHERE p.user_id = auth.user_id() AND p.premium));

CREATE POLICY rute_les ON bruker_rute FOR SELECT TO authenticated USING (user_id = auth.user_id());
CREATE POLICY rute_delt_les ON bruker_rute FOR SELECT TO authenticated USING (delt);
CREATE POLICY rute_ny ON bruker_rute FOR INSERT TO authenticated WITH CHECK (user_id = auth.user_id());
CREATE POLICY rute_endre ON bruker_rute FOR UPDATE TO authenticated USING (user_id = auth.user_id()) WITH CHECK (user_id = auth.user_id());
CREATE POLICY rute_slett ON bruker_rute FOR DELETE TO authenticated USING (user_id = auth.user_id());
CREATE POLICY rute_vaer_les ON rute_vaer FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM bruker_rute r WHERE r.id = rute_vaer.rute_id));

-- Admin og renn
CREATE POLICY admin_les ON admin FOR SELECT TO authenticated USING (user_id = auth.user_id());
CREATE POLICY konkurranse_admin ON konkurranse FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admin a WHERE a.user_id = auth.user_id())) WITH CHECK (EXISTS (SELECT 1 FROM admin a WHERE a.user_id = auth.user_id()));
CREATE POLICY renn_rute_admin ON renn_rute FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admin a WHERE a.user_id = auth.user_id())) WITH CHECK (EXISTS (SELECT 1 FROM admin a WHERE a.user_id = auth.user_id()));
CREATE POLICY renn_rute_les ON renn_rute FOR SELECT TO authenticated  -- bare pro kan lese rennløypene
  USING (EXISTS (SELECT 1 FROM profil p WHERE p.user_id = auth.user_id() AND p.pro));

-- ============ Egne funksjoner ============

-- Delte ruter som trenger værhistorikk (brukes av værjobben)
CREATE OR REPLACE FUNCTION public.delte_ruter_for_vaer()
 RETURNS TABLE(id uuid, lat double precision, lon double precision, ref_hoyde_m real, opprettet timestamptz)
 LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$ select r.id, r.start_lat, r.start_lon, (r.punkter->0->>2)::real, r.opprettet from public.bruker_rute r where r.delt $$;

-- Starter ruten innen 300 m fra start på en løype i databasen? Bare da kan en egen rute deles.
CREATE OR REPLACE FUNCTION public.er_kjent_utfartssted(p_lat double precision, p_lon double precision)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ select exists (select 1 from public.loype l where abs((l.start->>1)::float8 - p_lat) < 0.004 and abs((l.start->>0)::float8 - p_lon) < 0.008 and sqrt(power(((l.start->>1)::float8 - p_lat) * 111320, 2) + power(((l.start->>0)::float8 - p_lon) * 111320 * cos(radians(p_lat)), 2)) <= 300) $$;

-- Valideringstrigger på bruker_rute: navn påkrevd (maks 80 tegn), maks 50 ruter per bruker, deling bare fra kjent utfartssted
CREATE OR REPLACE FUNCTION public.bruker_rute_sjekk()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ begin if new.navn is null or length(btrim(new.navn)) = 0 then raise exception 'Ruten må ha et navn.'; end if; if length(new.navn) > 80 then raise exception 'Navnet kan ha opptil 80 tegn.'; end if; if tg_op = 'INSERT' and (select count(*) from public.bruker_rute where user_id = new.user_id) >= 50 then raise exception 'Du kan ha opptil 50 egne ruter. Slett noen først.'; end if; if new.delt and not public.er_kjent_utfartssted(new.start_lat, new.start_lon) then raise exception 'Ruten kan bare deles når den starter ved et kjent utfartssted. Den kan lagres privat.'; end if; return new; end $$;
