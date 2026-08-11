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
