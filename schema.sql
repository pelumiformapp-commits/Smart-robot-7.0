CREATE TABLE IF NOT EXISTS messages (
  id           SERIAL PRIMARY KEY,
  visitor_name TEXT NOT NULL,
  session_id   TEXT NOT NULL,
  role         TEXT NOT NULL,
  content      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);
