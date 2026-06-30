-- 013: Acceptation des règles de diffusion live (liveTermsAcceptedAt)
--
-- Le champ liveTermsAcceptedAt est stocké dans le JSONB payload des utilisateurs.
-- Aucune modification de schéma DDL n'est requise : le champ est persisté via
-- le payload JSONB existant, comme la quasi-totalité des champs User.
--
-- Ce fichier est requis pour que le runner de migrations enregistre la version 013
-- et marque la migration comme appliquée dans la table schema_migrations.

SELECT 1;
