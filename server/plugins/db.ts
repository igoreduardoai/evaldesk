import { runMigrations } from "@agent-native/core/db";

export default runMigrations(
  [
    {
      version: 1,
      name: "evaldesk-suites-cases-audit",
      sql: `CREATE TABLE IF NOT EXISTS suites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  policy TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (now()),
  owner_email TEXT NOT NULL DEFAULT 'local@localhost',
  org_id TEXT,
  visibility TEXT NOT NULL DEFAULT 'private'
);
CREATE TABLE IF NOT EXISTS suite_shares (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  principal_type TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (now()),
  notified_at TEXT
);
CREATE TABLE IF NOT EXISTS eval_cases (
  id TEXT PRIMARY KEY,
  suite_id TEXT NOT NULL REFERENCES suites(id),
  position INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  answer TEXT NOT NULL,
  must_include TEXT NOT NULL DEFAULT '',
  agent_verdict TEXT CHECK (agent_verdict IS NULL OR agent_verdict IN ('pass', 'fail')),
  agent_reason TEXT,
  agent_evidence TEXT,
  agent_graded_at TEXT,
  human_verdict TEXT CHECK (human_verdict IS NULL OR human_verdict IN ('pass', 'fail')),
  human_note TEXT,
  reviewed_at TEXT,
  is_regression BOOLEAN NOT NULL DEFAULT false,
  owner_email TEXT NOT NULL,
  org_id TEXT,
  created_at TEXT NOT NULL DEFAULT (now())
);
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  suite_id TEXT NOT NULL REFERENCES suites(id),
  case_id TEXT,
  actor TEXT NOT NULL CHECK (actor IN ('agent', 'human')),
  kind TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  owner_email TEXT NOT NULL,
  org_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS suites_owner_org_name_idx ON suites (owner_email, org_id, name);
CREATE INDEX IF NOT EXISTS suite_shares_resource_idx ON suite_shares (resource_id, principal_type, principal_id);
CREATE INDEX IF NOT EXISTS eval_cases_suite_pos_idx ON eval_cases (suite_id, position);
CREATE INDEX IF NOT EXISTS audit_events_suite_created_idx ON audit_events (suite_id, created_at)`,
    },
    {
      version: 2,
      name: "evaldesk-sources-reviews-prompts",
      sql: `ALTER TABLE suites ADD COLUMN IF NOT EXISTS data_kind TEXT NOT NULL DEFAULT 'synthetic';
ALTER TABLE suites ADD COLUMN IF NOT EXISTS source_name TEXT NOT NULL DEFAULT '';
ALTER TABLE suites ADD COLUMN IF NOT EXISTS source_url TEXT NOT NULL DEFAULT '';
ALTER TABLE suites ADD COLUMN IF NOT EXISTS source_license TEXT NOT NULL DEFAULT '';
ALTER TABLE eval_cases ADD COLUMN IF NOT EXISTS source_ref TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  suite_id TEXT NOT NULL REFERENCES suites(id),
  case_id TEXT NOT NULL REFERENCES eval_cases(id),
  reviewer TEXT NOT NULL,
  reviewer_kind TEXT NOT NULL CHECK (reviewer_kind IN ('human', 'simulated')),
  verdict TEXT NOT NULL CHECK (verdict IN ('pass', 'fail')),
  note TEXT NOT NULL DEFAULT '',
  owner_email TEXT NOT NULL,
  org_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (case_id, reviewer)
);
CREATE TABLE IF NOT EXISTS prompt_versions (
  id TEXT PRIMARY KEY,
  suite_id TEXT NOT NULL REFERENCES suites(id),
  version INTEGER NOT NULL,
  text TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  owner_email TEXT NOT NULL,
  org_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (suite_id, version)
);
CREATE INDEX IF NOT EXISTS reviews_suite_idx ON reviews (suite_id, case_id);
CREATE INDEX IF NOT EXISTS prompt_versions_suite_idx ON prompt_versions (suite_id, version)`,
    },
  ],
  { table: "evaldesk_app_migrations" },
);
