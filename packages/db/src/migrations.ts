import type { Pool, PoolClient } from "pg";
import { defaultPermissionsForRole } from "./schema/users";

const adminPermissions = defaultPermissionsForRole("admin");
const receptionistPermissions = defaultPermissionsForRole("receptionist");
const attendantPermissions = defaultPermissionsForRole("attendant");

type Migration = { id: string; sql: string };

const migrations: Migration[] = [
  {
    id: "001_visit_snapshots_and_password_change",
    sql: `
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE visits
        ADD COLUMN IF NOT EXISTS visitor_name TEXT,
        ADD COLUMN IF NOT EXISTS visitor_cpf TEXT,
        ADD COLUMN IF NOT EXISTS visitor_phone TEXT,
        ADD COLUMN IF NOT EXISTS visitor_company TEXT,
        ADD COLUMN IF NOT EXISTS visitor_city TEXT;
    `,
  },
  {
    id: "002_unique_visitor_cpf",
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS visitors_cpf_unique ON visitors (cpf);
    `,
  },
  {
    id: "003_required_visitor_cpf",
    sql: `
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM visitors WHERE cpf IS NULL OR btrim(cpf) = '') THEN
          RAISE EXCEPTION 'Existem visitantes sem CPF. Preencha esses registros antes de aplicar a obrigatoriedade do CPF.';
        END IF;
      END $$;
      ALTER TABLE visitors ALTER COLUMN cpf SET NOT NULL;
      UPDATE visits
        SET visitor_cpf = visitors.cpf
        FROM visitors
        WHERE visits.visitor_id = visitors.id
          AND (visits.visitor_cpf IS NULL OR btrim(visits.visitor_cpf) = '');
      ALTER TABLE visits ALTER COLUMN visitor_cpf SET NOT NULL;
      ALTER TABLE field_config ALTER COLUMN cpf SET DEFAULT 'required';
      UPDATE field_config SET cpf = 'required' WHERE cpf <> 'required';
      ALTER TABLE field_config DROP CONSTRAINT IF EXISTS field_config_cpf_check;
      ALTER TABLE field_config
        ADD CONSTRAINT field_config_cpf_check CHECK (cpf = 'required');
    `,
  },
  {
    id: "004_service_center",
    sql: `
      ALTER TABLE sectors
        ADD COLUMN IF NOT EXISTS queue_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS uses_desks BOOLEAN NOT NULL DEFAULT FALSE;
      UPDATE sectors
        SET queue_enabled = TRUE, uses_desks = TRUE
        WHERE lower(name) IN ('protocolo', 'dívida ativa', 'divida ativa');

      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS sector_id INTEGER REFERENCES sectors(id);
      ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'receptionist', 'attendant'));

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
        visit_id INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
        sector_id INTEGER NOT NULL REFERENCES sectors(id),
        status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'completed', 'cancelled')),
        queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        called_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        desk_id INTEGER REFERENCES service_desks(id),
        attendant_user_id INTEGER REFERENCES users(id),
        UNIQUE (visit_id)
      );

      CREATE INDEX IF NOT EXISTS service_queue_sector_status_order
        ON service_queue (sector_id, status, queued_at, id);

      CREATE TABLE IF NOT EXISTS service_calls (
        id SERIAL PRIMARY KEY,
        queue_id INTEGER NOT NULL REFERENCES service_queue(id) ON DELETE CASCADE,
        sector_id INTEGER NOT NULL REFERENCES sectors(id),
        desk_id INTEGER REFERENCES service_desks(id),
        attendant_user_id INTEGER NOT NULL REFERENCES users(id),
        called_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS service_calls_called_at ON service_calls (called_at DESC);
    `,
  },
  {
    id: "005_user_permissions",
    sql: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{
        "editVisitorName": true,
        "editVisitorCpf": true,
        "editVisitorPhone": true,
        "editVisitorCompany": true,
        "editVisitorCity": true
      }'::jsonb;
    `,
  },
  {
    id: "006_single_ongoing_visit_per_visitor",
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM visits
          WHERE status = 'ongoing'
          GROUP BY visitor_id
          HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION 'Existem visitantes com mais de uma visita em andamento. Finalize ou cancele as visitas duplicadas antes de iniciar a aplicação.';
        END IF;
      END $$;

      CREATE UNIQUE INDEX IF NOT EXISTS visits_one_ongoing_per_visitor
        ON visits (visitor_id)
        WHERE status = 'ongoing';
    `,
  },
  {
    id: "007_birth_date_priority_waiting_status_permissions",
    sql: `
      ALTER TABLE visitors ADD COLUMN IF NOT EXISTS birth_date DATE;
      ALTER TABLE visits
        ADD COLUMN IF NOT EXISTS visitor_birth_date DATE,
        ADD COLUMN IF NOT EXISTS priority_reason TEXT;

      ALTER TABLE service_queue
        ADD COLUMN IF NOT EXISTS priority_level INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS priority_reason TEXT;
      CREATE INDEX IF NOT EXISTS service_queue_priority_order
        ON service_queue (sector_id, status, priority_level DESC, queued_at, id);

      -- Visitas na fila que ainda não foram chamadas passam a ficar "aguardando".
      ALTER TABLE visits DROP CONSTRAINT IF EXISTS visits_status_check;
      ALTER TABLE visits ADD CONSTRAINT visits_status_check
        CHECK (status IN ('waiting', 'ongoing', 'finished', 'cancelled'));
      DROP INDEX IF EXISTS visits_one_ongoing_per_visitor;
      CREATE UNIQUE INDEX visits_one_ongoing_per_visitor
        ON visits (visitor_id)
        WHERE status IN ('waiting', 'ongoing');
      UPDATE visits SET status = 'waiting'
        FROM service_queue q
        WHERE q.visit_id = visits.id AND q.status = 'waiting' AND visits.status = 'ongoing';

      -- Permissões passam a cobrir o sistema inteiro. Recepcionistas mantêm as
      -- permissões de edição de visitante que já tinham.
      ALTER TABLE users ALTER COLUMN permissions SET DEFAULT '${JSON.stringify(receptionistPermissions)}'::jsonb;
      UPDATE users SET permissions = CASE role
        WHEN 'attendant' THEN '${JSON.stringify(attendantPermissions)}'::jsonb
        WHEN 'admin' THEN '${JSON.stringify(adminPermissions)}'::jsonb
        ELSE '${JSON.stringify(receptionistPermissions)}'::jsonb || permissions
          || jsonb_build_object('editVisitorBirthDate', COALESCE((permissions->>'editVisitorName')::boolean, TRUE))
      END;
    `,
  },
];

async function applyMigration(
  client: PoolClient,
  migration: Migration,
): Promise<void> {
  await client.query("BEGIN");
  try {
    const applied = await client.query<{ id: string }>(
      "SELECT id FROM schema_migrations WHERE id = $1",
      [migration.id],
    );
    if (applied.rowCount === 0) {
      await client.query(migration.sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [
        migration.id,
      ]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

/** Applies pending, versioned database migrations before the API starts. */
export async function runMigrations(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    for (const migration of migrations) await applyMigration(client, migration);
  } finally {
    client.release();
  }
}
