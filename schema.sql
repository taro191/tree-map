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
