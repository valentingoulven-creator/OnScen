CREATE TABLE IF NOT EXISTS feed_post_upvotes (
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (post_id, user_id)
);
