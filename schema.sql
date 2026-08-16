CREATE TABLE IF NOT EXISTS messages (
  id           SERIAL PRIMARY KEY,
  visitor_name TEXT NOT NULL,
  session_id   TEXT NOT NULL,
  role         TEXT NOT NULL,
  content      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

  CREATE TABLE IF NOT EXISTS devices (
  session_id   TEXT PRIMARY KEY,
  onesignal_id TEXT NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);

CREATE TABLE IF NOT EXISTS usage_limits (
  session_id TEXT,
  usage_date DATE,
  count INTEGER DEFAULT 1,
  PRIMARY KEY (session_id, usage_date)
);

CREATE TABLE IF NOT EXISTS todos (
  id           SERIAL PRIMARY KEY,
  session_id   TEXT NOT NULL,
  content      TEXT NOT NULL,
  done         BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_todos_session ON todos(session_id, created_at);

CREATE TABLE IF NOT EXISTS notes (
  id           SERIAL PRIMARY KEY,
  session_id   TEXT NOT NULL,
  content      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_session ON notes(session_id, created_at);

CREATE TABLE IF NOT EXISTS reminders (
  id           SERIAL PRIMARY KEY,
  session_id   TEXT NOT NULL,
  content      TEXT NOT NULL,
  remind_at    TIMESTAMPTZ NOT NULL,
  sent         BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reminders_session ON reminders(session_id, remind_at);
CREATE INDEX IF NOT EXISTS idx_reminders_pending ON reminders(sent, remind_at) WHERE sent = FALSE;
