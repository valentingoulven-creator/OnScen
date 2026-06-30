-- MODIF 534 : champ optionnel displayDurationSec dans payload JSONB sponsors.
-- Aucune migration de schéma requise (payload JSONB extensible).
-- Valeur par défaut appliquée côté application : 8 secondes.

COMMENT ON TABLE sponsors IS 'Sponsors publicitaires ; payload JSONB inclut displayDurationSec (3–60 s, défaut 8).';
