-- Migration 014: Email verification and password reset
-- Fields emailVerified, verificationToken, verificationTokenExpiry,
-- resetToken, resetTokenExpiry are stored in the payload JSONB column.
-- This migration is a no-op SQL marker (logic handled in application layer).
SELECT 1;
