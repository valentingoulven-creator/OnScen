CREATE TABLE IF NOT EXISTS support_contact_messages (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_support_contact_messages_from_user
  ON support_contact_messages ((payload->>'fromUserId'));

CREATE INDEX IF NOT EXISTS idx_support_contact_messages_status
  ON support_contact_messages ((payload->>'status'));
