-- MariaDB / MySQL schema (used when DATABASE_URL starts with mysql://).
-- Mirrors schema.sql (Postgres) column-for-column. Statements are split on ';' at
-- line end and run one at a time by server/mysql.js, so keep one statement per ';'.
-- Photos are stored as base64 data URLs, hence LONGTEXT (TEXT caps at 64KB).
-- Future column additions: append `ALTER TABLE x ADD COLUMN IF NOT EXISTS ...;`
-- (MariaDB syntax) here AND the matching line in schema.sql.

CREATE TABLE IF NOT EXISTS purposes (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_enterprises (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  registration_no TEXT,
  district TEXT,
  province TEXT,
  postcode TEXT,
  registered_date DATE,
  chairperson TEXT,
  contact_phone TEXT,
  purpose TEXT,
  purpose_id VARCHAR(64),
  max_plot_area_rai DECIMAL(12,2),
  document_photo LONGTEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_ce_purpose FOREIGN KEY (purpose_id) REFERENCES purposes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(32) UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  national_id VARCHAR(32) UNIQUE,
  dob DATE,
  role VARCHAR(32) NOT NULL DEFAULT 'admin',
  managed_community_enterprise_id VARCHAR(64),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_users_managed_ce FOREIGN KEY (managed_community_enterprise_id) REFERENCES community_enterprises(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS plots (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  owner_name TEXT,
  owner_contact TEXT,
  doc_title TEXT,
  area_rai TEXT,
  area_ngan TEXT,
  area_wa TEXT,
  subdistrict TEXT,
  district TEXT,
  province TEXT,
  postcode TEXT,
  color TEXT,
  boundary LONGTEXT,
  photo LONGTEXT,
  doc_photo LONGTEXT,
  community_enterprise_id VARCHAR(64),
  community_enterprise_status VARCHAR(32),
  purpose_id VARCHAR(64),
  ref_lat DOUBLE,
  ref_lng DOUBLE,
  ref_description TEXT,
  ref_photos LONGTEXT,
  created_by VARCHAR(64),
  status VARCHAR(32) NOT NULL DEFAULT 'data_entry',
  review_note TEXT,
  review_photos LONGTEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_plots_ce FOREIGN KEY (community_enterprise_id) REFERENCES community_enterprises(id) ON DELETE SET NULL,
  CONSTRAINT fk_plots_purpose FOREIGN KEY (purpose_id) REFERENCES purposes(id) ON DELETE SET NULL,
  CONSTRAINT fk_plots_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trees (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  plot_id VARCHAR(64) NOT NULL,
  seq INT NOT NULL,
  name TEXT,
  photo_url LONGTEXT,
  code TEXT,
  code_photo LONGTEXT,
  note TEXT,
  lat DOUBLE NOT NULL,
  lng DOUBLE NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_trees_plot_id (plot_id),
  CONSTRAINT fk_trees_plot FOREIGN KEY (plot_id) REFERENCES plots(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_enterprise_members (
  community_enterprise_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  joined_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (community_enterprise_id, user_id),
  CONSTRAINT fk_cem_ce FOREIGN KEY (community_enterprise_id) REFERENCES community_enterprises(id) ON DELETE CASCADE,
  CONSTRAINT fk_cem_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

UPDATE plots SET status = 'tree_survey'
WHERE status = 'data_entry' AND EXISTS (SELECT 1 FROM trees WHERE trees.plot_id = plots.id);
