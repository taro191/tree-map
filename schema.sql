CREATE TABLE IF NOT EXISTS plots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_name TEXT,
  owner_contact TEXT,
  doc_title TEXT,
  area_rai TEXT,
  area_ngan TEXT,
  area_wa TEXT,
  district TEXT,
  province TEXT,
  postcode TEXT,
  color TEXT,
  boundary JSONB,
  photo TEXT,
  doc_photo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trees (
  id TEXT PRIMARY KEY,
  plot_id TEXT NOT NULL REFERENCES plots(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  name TEXT,
  photo_url TEXT,
  note TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trees_plot_id ON trees(plot_id);

ALTER TABLE trees ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE trees ADD COLUMN IF NOT EXISTS code_photo TEXT;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS national_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dob DATE;

CREATE TABLE IF NOT EXISTS community_enterprises (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  registration_no TEXT,
  district TEXT,
  province TEXT,
  postcode TEXT,
  registered_date DATE,
  chairperson TEXT,
  contact_phone TEXT,
  purpose TEXT,
  document_photo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_enterprise_members (
  community_enterprise_id TEXT NOT NULL REFERENCES community_enterprises(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (community_enterprise_id, user_id)
);

ALTER TABLE plots ADD COLUMN IF NOT EXISTS community_enterprise_id TEXT REFERENCES community_enterprises(id) ON DELETE SET NULL;

ALTER TABLE plots ADD COLUMN IF NOT EXISTS ref_lat DOUBLE PRECISION;
ALTER TABLE plots ADD COLUMN IF NOT EXISTS ref_lng DOUBLE PRECISION;
ALTER TABLE plots ADD COLUMN IF NOT EXISTS ref_description TEXT;
ALTER TABLE plots ADD COLUMN IF NOT EXISTS ref_photos JSONB;

ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin';
ALTER TABLE users ADD COLUMN IF NOT EXISTS managed_community_enterprise_id TEXT REFERENCES community_enterprises(id) ON DELETE SET NULL;

ALTER TABLE plots ADD COLUMN IF NOT EXISTS subdistrict TEXT;
ALTER TABLE plots ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE plots ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'data_entry';
ALTER TABLE plots ADD COLUMN IF NOT EXISTS review_note TEXT;
ALTER TABLE plots ADD COLUMN IF NOT EXISTS review_photos JSONB;

-- One-time backfill for plots created before the status workflow existed: a plot that
-- already has trees should start at tree_survey, not data_entry, so its "ส่งแปลงตรวจสอบ"
-- button is available immediately instead of looking permanently missing. Safe to re-run
-- every boot since it only ever touches rows still sitting at the default data_entry status.
UPDATE plots SET status = 'tree_survey'
WHERE status = 'data_entry' AND EXISTS (SELECT 1 FROM trees WHERE trees.plot_id = plots.id);

CREATE TABLE IF NOT EXISTS purposes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE plots ADD COLUMN IF NOT EXISTS purpose_id TEXT REFERENCES purposes(id) ON DELETE SET NULL;
ALTER TABLE community_enterprises ADD COLUMN IF NOT EXISTS purpose_id TEXT REFERENCES purposes(id) ON DELETE SET NULL;
