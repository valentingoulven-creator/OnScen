# Bug-hunt memory

Tracks previously reported bugs with an open or rejected PR, so future runs don't re-report them. Entries are removed once merged (fixed) or once the underlying code is confirmed no longer present. Rejected entries older than 30 days should be dropped (treat as worth a fresh look).

- `commun/backend/src/lib/pgDirectMessages.ts` (`syncDirectMessagesToPg`): RAM cap added by `trimDirectMessages` (MODIF 963/c4791057) fed the periodic Postgres flush's DELETE-by-diff, permanently erasing DM history beyond 500 msgs/pair from the DB on every flush. PR: https://github.com/valentingoulven-creator/MeloSong/pull/33 — status: open — recorded: 2026-07-09
