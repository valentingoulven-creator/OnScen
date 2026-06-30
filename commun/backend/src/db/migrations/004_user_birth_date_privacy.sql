-- MODIF 294 : birthDate + hideBirthDateOnProfile (users.payload JSONB)
-- Pas d'ALTER TABLE : champs optionnels dans le document utilisateur sérialisé.

INSERT INTO schema_migrations (version) VALUES (4) ON CONFLICT DO NOTHING;
