-- =============================================================================
-- Inicialização do banco de dados - Sistema de Controle de Visitantes
-- Executado automaticamente pelo PostgreSQL na primeira inicialização.
-- =============================================================================

-- ── Tabelas independentes ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  login         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'receptionist'
                  CHECK (role IN ('admin', 'receptionist', 'attendant')),
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'inactive')),
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  permissions JSONB NOT NULL DEFAULT '{"editVisitorName":true,"editVisitorCpf":true,"editVisitorPhone":true,"editVisitorCompany":true,"editVisitorCity":true}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS sectors (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  secretariat  TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'inactive')),
  queue_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  uses_desks    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visitors (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  cpf        TEXT NOT NULL,
  phone      TEXT,
  company    TEXT,
  city       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS sector_id INTEGER REFERENCES sectors(id);

CREATE UNIQUE INDEX IF NOT EXISTS visitors_cpf_unique ON visitors (cpf);

-- ── Tabelas dependentes ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS visits (
  id            SERIAL PRIMARY KEY,
  visitor_id    INTEGER NOT NULL REFERENCES visitors(id),
  sector_id     INTEGER NOT NULL REFERENCES sectors(id),
  responsible   TEXT,
  reason        TEXT,
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'ongoing'
                  CHECK (status IN ('ongoing', 'finished', 'cancelled')),
  entry_date    TEXT NOT NULL,
  entry_time    TEXT NOT NULL,
  entry_user_id INTEGER NOT NULL REFERENCES users(id),
  exit_date     TEXT,
  exit_time     TEXT,
  exit_user_id  INTEGER REFERENCES users(id),
  cancel_reason TEXT,

    -- snapshot dos dados do visitante no momento da visita
  visitor_name    TEXT,
  visitor_cpf     TEXT NOT NULL,
  visitor_phone   TEXT,
  visitor_company TEXT,
  visitor_city    TEXT,
  
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_desks (
  id SERIAL PRIMARY KEY,
  sector_id INTEGER NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sector_id, name)
);

CREATE TABLE IF NOT EXISTS service_queue (
  id SERIAL PRIMARY KEY,
  visit_id INTEGER NOT NULL UNIQUE REFERENCES visits(id) ON DELETE CASCADE,
  sector_id INTEGER NOT NULL REFERENCES sectors(id),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'completed', 'cancelled')),
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  called_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  desk_id INTEGER REFERENCES service_desks(id),
  attendant_user_id INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS service_calls (
  id SERIAL PRIMARY KEY,
  queue_id INTEGER NOT NULL REFERENCES service_queue(id) ON DELETE CASCADE,
  sector_id INTEGER NOT NULL REFERENCES sectors(id),
  desk_id INTEGER REFERENCES service_desks(id),
  attendant_user_id INTEGER NOT NULL REFERENCES users(id),
  called_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id            SERIAL PRIMARY KEY,
  action        TEXT NOT NULL,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  ip_address    TEXT,
  entity_type   TEXT,
  entity_id     INTEGER,
  previous_data TEXT,
  new_data      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Configurações ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS field_config (
  id          SERIAL PRIMARY KEY,
  cpf         TEXT NOT NULL DEFAULT 'required'
                CHECK (cpf = 'required'),
  phone       TEXT NOT NULL DEFAULT 'optional'
                CHECK (phone IN ('hidden', 'optional', 'required')),
  company     TEXT NOT NULL DEFAULT 'optional'
                CHECK (company IN ('hidden', 'optional', 'required')),
  city        TEXT NOT NULL DEFAULT 'optional'
                CHECK (city IN ('hidden', 'optional', 'required')),
  responsible TEXT NOT NULL DEFAULT 'optional'
                CHECK (responsible IN ('hidden', 'optional', 'required')),
  reason      TEXT NOT NULL DEFAULT 'optional'
                CHECK (reason IN ('hidden', 'optional', 'required')),
  notes       TEXT NOT NULL DEFAULT 'optional'
                CHECK (notes IN ('hidden', 'optional', 'required')),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS label_config (
  id                 SERIAL PRIMARY KEY,
  municipality_name  TEXT NOT NULL DEFAULT 'Prefeitura Municipal de Paraíba do Sul',
  title              TEXT NOT NULL DEFAULT 'Identificação de Visitante',
  logo_url           TEXT,
  show_logo          BOOLEAN NOT NULL DEFAULT FALSE,
  show_qr_code       BOOLEAN NOT NULL DEFAULT TRUE,
  show_name          BOOLEAN NOT NULL DEFAULT TRUE,
  show_sector        BOOLEAN NOT NULL DEFAULT TRUE,
  show_date          BOOLEAN NOT NULL DEFAULT TRUE,
  show_time          BOOLEAN NOT NULL DEFAULT TRUE,
  show_visit_number  BOOLEAN NOT NULL DEFAULT TRUE,
  label_width        REAL NOT NULL DEFAULT 100,
  label_height       REAL NOT NULL DEFAULT 60,
  margin_top         REAL NOT NULL DEFAULT 3,
  margin_right       REAL NOT NULL DEFAULT 3,
  margin_bottom      REAL NOT NULL DEFAULT 3,
  margin_left        REAL NOT NULL DEFAULT 3,
  font_size          REAL NOT NULL DEFAULT 12,
  font_family        TEXT NOT NULL DEFAULT 'Arial',
  printer_model      TEXT NOT NULL DEFAULT 'custom',
  elements_layout    TEXT,
  header_text        TEXT,
  footer_text        TEXT,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Dados iniciais ─────────────────────────────────────────────────────────────
-- O primeiro administrador é solicitado e criado pelo backend no startup
-- (ver apps/backend/src/lib/seed.ts).

-- Configuração de campos padrão
INSERT INTO field_config (cpf, phone, company, city, responsible, reason, notes)
VALUES ('required', 'optional', 'optional', 'optional', 'optional', 'optional', 'optional')
ON CONFLICT DO NOTHING;

-- Configuração de etiqueta padrão
INSERT INTO label_config DEFAULT VALUES
ON CONFLICT DO NOTHING;
