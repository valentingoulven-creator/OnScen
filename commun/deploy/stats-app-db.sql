-- =============================================================================
-- Soundy / MeloSong — Statistiques application & base PostgreSQL (production)
-- =============================================================================
-- Fichier : deploy/stats-app-db.sql
-- Cible   : PostgreSQL 16 (Scaleway Managed Database)
-- Schéma  : migrations 001–004 (backend/src/db/migrations/)
--
-- Usage local / VPS :
--   set -a && source /opt/soundy/.env && set +a
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /opt/soundy/deploy/stats-app-db.sql
--
-- Ou via le wrapper : bash /opt/soundy/deploy/stats-app-db.sh
--
-- Notes :
--   • Les horodatages applicatifs sont en millisecondes (epoch ms) sauf mention.
--   • Conversion : to_timestamp((ms)::double precision / 1000.0)
--   • Les comptes bots de démo ont un id préfixé « bot_ » (exclus des stats utilisateurs).
--   • Certaines tables (reels, abonnements, cadeaux…) existent en schéma mais peuvent
--     être vides si la persistance PG n’a pas encore été étendue (données encore en RAM).
--   • Les signalements de contenu sont dans un fichier JSONL sur le VPS, pas en base
--     (voir section Modération).
-- =============================================================================

\set QUIET on
\pset border 2
\pset null '(nul)'
\timing on
\set QUIET off

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLEAU DE BORD — KPI synthèse (une ligne, lecture dashboard)
-- ─────────────────────────────────────────────────────────────────────────────
\echo ''
\echo '═══════════════════════════════════════════════════════════════════'
\echo ' TABLEAU DE BORD — KPI SYNTHÈSE'
\echo '═══════════════════════════════════════════════════════════════════'

SELECT
  -- Utilisateurs
  (SELECT COUNT(*) FROM users WHERE id NOT LIKE 'bot\_%' ESCAPE '\')                          AS utilisateurs_total,
  (SELECT COUNT(*) FROM users WHERE id NOT LIKE 'bot\_%' ESCAPE '\'
     AND COALESCE(account_status, 'active') = 'active')                                       AS utilisateurs_actifs_compte,
  (SELECT COUNT(*) FROM users WHERE id NOT LIKE 'bot\_%' ESCAPE '\'
     AND account_status = 'pending')                                                        AS utilisateurs_en_attente,
  (SELECT COUNT(*) FROM users WHERE id NOT LIKE 'bot\_%' ESCAPE '\'
     AND account_status = 'blocked')                                                         AS utilisateurs_bloques,
  (SELECT COUNT(*) FROM users WHERE id NOT LIKE 'bot\_%' ESCAPE '\'
     AND ((payload->>'memberSince')::bigint) > (EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours') * 1000)::bigint)
                                                                                              AS inscriptions_24h,
  (SELECT COUNT(*) FROM users WHERE id NOT LIKE 'bot\_%' ESCAPE '\'
     AND ((payload->>'memberSince')::bigint) > (EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days') * 1000)::bigint)
                                                                                              AS inscriptions_7j,
  (SELECT COUNT(*) FROM users WHERE id NOT LIKE 'bot\_%' ESCAPE '\'
     AND ((payload->>'memberSince')::bigint) > (EXTRACT(EPOCH FROM NOW() - INTERVAL '30 days') * 1000)::bigint)
                                                                                              AS inscriptions_30j,
  (SELECT COUNT(*) FROM users WHERE id NOT LIKE 'bot\_%' ESCAPE '\'
     AND ((payload->>'lastSeenAt')::bigint) > (EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours') * 1000)::bigint)
                                                                                              AS dau_24h,
  (SELECT COUNT(*) FROM users WHERE id NOT LIKE 'bot\_%' ESCAPE '\'
     AND ((payload->>'lastSeenAt')::bigint) > (EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days') * 1000)::bigint)
                                                                                              AS wau_7j,
  (SELECT COUNT(*) FROM users WHERE id NOT LIKE 'bot\_%' ESCAPE '\'
     AND ((payload->>'lastSeenAt')::bigint) > (EXTRACT(EPOCH FROM NOW() - INTERVAL '30 days') * 1000)::bigint)
                                                                                              AS mau_30j,
  -- Engagement social
  (SELECT COUNT(*) FROM user_follows)                                                         AS follows_total,
  (SELECT COUNT(*) FROM user_favorites)                                                       AS favoris_host_total,
  (SELECT COUNT(*) FROM heart_events)                                                         AS coeurs_profil_total,
  (SELECT COUNT(*) FROM music_matches)                                                        AS matchs_musicaux_total,
  -- Messagerie
  (SELECT COUNT(*) FROM direct_messages)                                                      AS messages_dm_total,
  (SELECT COUNT(*) FROM group_messages)                                                       AS messages_groupe_total,
  (SELECT COUNT(*) FROM message_groups)                                                       AS groupes_discussion_total,
  (SELECT COUNT(*) FROM dm_pending_pairs WHERE status = 'pending')                            AS dm_en_attente,
  -- Salons & lives
  (SELECT COUNT(*) FROM salons)                                                               AS salons_total,
  (SELECT COUNT(*) FROM salons WHERE is_active = TRUE)                                        AS salons_actifs,
  (SELECT COUNT(*) FROM lives)                                                                AS lives_total,
  (SELECT COUNT(*) FROM lives WHERE is_active = TRUE)                                         AS lives_actifs,
  -- Contenu
  (SELECT COUNT(*) FROM feed_posts)                                                           AS posts_feed_total,
  (SELECT COUNT(*) FROM feed_post_likes)                                                      AS likes_feed_total,
  (SELECT COUNT(*) FROM feed_post_comments)                                                   AS commentaires_feed_total,
  (SELECT COUNT(*) FROM stories)                                                              AS stories_total,
  (SELECT COUNT(*) FROM stories
     WHERE expires_at_ts > (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint)                        AS stories_actives,
  (SELECT COUNT(*) FROM user_reels)                                                           AS reels_total,
  (SELECT COUNT(*) FROM reel_likes)                                                         AS likes_reels_total,
  (SELECT COUNT(*) FROM reel_views)                                                           AS vues_reels_uniques,
  -- Monétisation
  (SELECT COUNT(*) FROM creator_subscriptions WHERE status = 'active')                        AS abonnements_actifs,
  (SELECT COUNT(*) FROM gifts)                                                                AS cadeaux_live_total,
  (SELECT COALESCE(SUM(amount_cents), 0) FROM donation_payments WHERE status = 'succeeded')    AS dons_cents_confirmes,
  -- Modération
  (SELECT COUNT(*) FROM user_blocks)                                                          AS blocages_total,
  (SELECT COUNT(*) FROM user_mutes)                                                           AS muettes_total,
  (SELECT COUNT(*) FROM live_bans)                                                            AS bans_live_total,
  (SELECT COUNT(*) FROM salon_bans)                                                           AS bans_salon_total,
  -- Meta
  to_timestamp((SELECT saved_at FROM store_meta WHERE id = 1)::double precision / 1000.0)
    AT TIME ZONE 'Europe/Paris'                                                               AS derniere_sauvegarde_pg,
  NOW() AT TIME ZONE 'Europe/Paris'                                                           AS genere_le;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. UTILISATEURS
-- ─────────────────────────────────────────────────────────────────────────────
\echo ''
\echo '═══════════════════════════════════════════════════════════════════'
\echo ' 1. UTILISATEURS'
\echo '═══════════════════════════════════════════════════════════════════'

\echo ''
\echo '--- 1.1 Totaux par statut de compte ---'
SELECT
  COALESCE(account_status, 'active') AS statut,
  COUNT(*)                           AS nombre
FROM users
WHERE id NOT LIKE 'bot\_%' ESCAPE '\'
GROUP BY COALESCE(account_status, 'active')
ORDER BY nombre DESC;

\echo ''
\echo '--- 1.2 Comptes bots (hors stats utilisateurs réels) ---'
SELECT COUNT(*) AS bots_total
FROM users
WHERE id LIKE 'bot\_%' ESCAPE '\';

\echo ''
\echo '--- 1.3 Administrateurs (payload.isAdmin = true) ---'
SELECT COUNT(*) AS admins_total
FROM users
WHERE (payload->>'isAdmin')::boolean IS TRUE;

\echo ''
\echo '--- 1.4 Inscriptions par jour (30 derniers jours, hors bots) ---'
SELECT
  to_timestamp(((payload->>'memberSince')::bigint)::double precision / 1000.0)
    AT TIME ZONE 'Europe/Paris' AS jour,
  COUNT(*) AS inscriptions
FROM users
WHERE id NOT LIKE 'bot\_%' ESCAPE '\'
  AND (payload->>'memberSince') IS NOT NULL
  AND to_timestamp(((payload->>'memberSince')::bigint)::double precision / 1000.0)
      >= (NOW() AT TIME ZONE 'Europe/Paris') - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1 DESC;

\echo ''
\echo '--- 1.5 Inscriptions par semaine (12 dernières semaines) ---'
SELECT
  date_trunc('week',
    to_timestamp(((payload->>'memberSince')::bigint)::double precision / 1000.0)
    AT TIME ZONE 'Europe/Paris'
  )::date AS semaine_debut,
  COUNT(*) AS inscriptions
FROM users
WHERE id NOT LIKE 'bot\_%' ESCAPE '\'
  AND (payload->>'memberSince') IS NOT NULL
  AND to_timestamp(((payload->>'memberSince')::bigint)::double precision / 1000.0)
      >= (NOW() AT TIME ZONE 'Europe/Paris') - INTERVAL '12 weeks'
GROUP BY 1
ORDER BY 1 DESC;

\echo ''
\echo '--- 1.6 Inscriptions par mois (12 derniers mois) ---'
SELECT
  date_trunc('month',
    to_timestamp(((payload->>'memberSince')::bigint)::double precision / 1000.0)
    AT TIME ZONE 'Europe/Paris'
  )::date AS mois,
  COUNT(*) AS inscriptions
FROM users
WHERE id NOT LIKE 'bot\_%' ESCAPE '\'
  AND (payload->>'memberSince') IS NOT NULL
  AND to_timestamp(((payload->>'memberSince')::bigint)::double precision / 1000.0)
      >= (NOW() AT TIME ZONE 'Europe/Paris') - INTERVAL '12 months'
GROUP BY 1
ORDER BY 1 DESC;

\echo ''
\echo '--- 1.7 Utilisateurs actifs (lastSeenAt) par jour — 14 derniers jours ---'
SELECT
  to_timestamp(((payload->>'lastSeenAt')::bigint)::double precision / 1000.0)
    AT TIME ZONE 'Europe/Paris' AS jour,
  COUNT(*) AS utilisateurs_actifs
FROM users
WHERE id NOT LIKE 'bot\_%' ESCAPE '\'
  AND (payload->>'lastSeenAt') IS NOT NULL
  AND to_timestamp(((payload->>'lastSeenAt')::bigint)::double precision / 1000.0)
      >= (NOW() AT TIME ZONE 'Europe/Paris') - INTERVAL '14 days'
GROUP BY 1
ORDER BY 1 DESC;

\echo ''
\echo '--- 1.8 Répartition par rôle d''écoute (listeningRole) ---'
SELECT
  COALESCE(payload->>'listeningRole', '(non renseigné)') AS role_ecoute,
  COUNT(*) AS nombre
FROM users
WHERE id NOT LIKE 'bot\_%' ESCAPE '\'
GROUP BY 1
ORDER BY nombre DESC;

\echo ''
\echo '--- 1.9 Répartition par type de profil (profileType) ---'
SELECT
  COALESCE(payload->>'profileType', '(non renseigné)') AS type_profil,
  COUNT(*) AS nombre
FROM users
WHERE id NOT LIKE 'bot\_%' ESCAPE '\'
GROUP BY 1
ORDER BY nombre DESC;

\echo ''
\echo '--- 1.10 Plateformes connectées (OAuth) ---'
SELECT
  platform,
  COUNT(*) AS utilisateurs
FROM users u,
  LATERAL jsonb_array_elements_text(COALESCE(u.payload->'connectedPlatforms', '[]'::jsonb)) AS platform
WHERE u.id NOT LIKE 'bot\_%' ESCAPE '\'
GROUP BY platform
ORDER BY utilisateurs DESC;

\echo ''
\echo '--- 1.11 Mode fantôme (isGhostMode) ---'
SELECT
  CASE WHEN (payload->>'isGhostMode')::boolean IS TRUE THEN 'fantôme' ELSE 'visible' END AS mode,
  COUNT(*) AS nombre
FROM users
WHERE id NOT LIKE 'bot\_%' ESCAPE '\'
GROUP BY 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. DÉMOGRAPHIE & GÉOGRAPHIE
-- ─────────────────────────────────────────────────────────────────────────────
\echo ''
\echo '═══════════════════════════════════════════════════════════════════'
\echo ' 2. DÉMOGRAPHIE & GÉOGRAPHIE'
\echo '═══════════════════════════════════════════════════════════════════'

\echo ''
\echo '--- 2.1 Âge — utilisateurs avec birthDate renseignée ---'
SELECT
  COUNT(*) FILTER (WHERE payload->>'birthDate' IS NOT NULL) AS avec_birth_date,
  COUNT(*) FILTER (WHERE payload->>'birthDate' IS NULL AND payload->>'age' IS NOT NULL) AS avec_age_seul,
  COUNT(*) FILTER (WHERE payload->>'birthDate' IS NULL AND payload->>'age' IS NULL) AS sans_age
FROM users
WHERE id NOT LIKE 'bot\_%' ESCAPE '\';

\echo ''
\echo '--- 2.2 Distribution par tranche d''âge (birthDate) ---'
SELECT
  CASE
    WHEN age_years < 18 THEN '< 18'
    WHEN age_years BETWEEN 18 AND 24 THEN '18-24'
    WHEN age_years BETWEEN 25 AND 34 THEN '25-34'
    WHEN age_years BETWEEN 35 AND 44 THEN '35-44'
    WHEN age_years BETWEEN 45 AND 54 THEN '45-54'
    WHEN age_years >= 55 THEN '55+'
    ELSE 'inconnu'
  END AS tranche,
  COUNT(*) AS nombre
FROM (
  SELECT
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, (payload->>'birthDate')::date))::int AS age_years
  FROM users
  WHERE id NOT LIKE 'bot\_%' ESCAPE '\'
    AND payload->>'birthDate' ~ '^\d{4}-\d{2}-\d{2}$'
) t
GROUP BY 1
ORDER BY
  CASE tranche
    WHEN '< 18' THEN 1 WHEN '18-24' THEN 2 WHEN '25-34' THEN 3
    WHEN '35-44' THEN 4 WHEN '45-54' THEN 5 WHEN '55+' THEN 6 ELSE 7
  END;

\echo ''
\echo '--- 2.3 Âge moyen, médian, min, max (birthDate) ---'
SELECT
  ROUND(AVG(age_years)::numeric, 1)  AS age_moyen,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY age_years) AS age_median,
  MIN(age_years) AS age_min,
  MAX(age_years) AS age_max
FROM (
  SELECT EXTRACT(YEAR FROM AGE(CURRENT_DATE, (payload->>'birthDate')::date))::int AS age_years
  FROM users
  WHERE id NOT LIKE 'bot\_%' ESCAPE '\'
    AND payload->>'birthDate' ~ '^\d{4}-\d{2}-\d{2}$'
) t;

\echo ''
\echo '--- 2.4 Top 20 villes (payload.city) ---'
SELECT
  COALESCE(NULLIF(TRIM(payload->>'city'), ''), '(non renseigné)') AS ville,
  COUNT(*) AS utilisateurs
FROM users
WHERE id NOT LIKE 'bot\_%' ESCAPE '\'
GROUP BY 1
ORDER BY utilisateurs DESC
LIMIT 20;

\echo ''
\echo '--- 2.5 Utilisateurs avec position GPS (latitude/longitude) ---'
SELECT
  COUNT(*) FILTER (WHERE payload->>'latitude' IS NOT NULL AND payload->>'longitude' IS NOT NULL) AS avec_gps,
  COUNT(*) FILTER (WHERE payload->>'latitude' IS NULL OR payload->>'longitude' IS NULL)     AS sans_gps
FROM users
WHERE id NOT LIKE 'bot\_%' ESCAPE '\';

\echo ''
\echo '--- 2.6 Précision de localisation partagée ---'
SELECT
  COALESCE(payload->>'locationPrecision', '(défaut)') AS precision,
  COUNT(*) AS nombre
FROM users
WHERE id NOT LIKE 'bot\_%' ESCAPE '\'
GROUP BY 1
ORDER BY nombre DESC;

\echo ''
\echo '--- 2.7 Statut relationnel (relationshipStatus) ---'
SELECT
  COALESCE(payload->>'relationshipStatus', '(non renseigné)') AS statut,
  COUNT(*) AS nombre
FROM users
WHERE id NOT LIKE 'bot\_%' ESCAPE '\'
GROUP BY 1
ORDER BY nombre DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ENGAGEMENT SOCIAL
-- ─────────────────────────────────────────────────────────────────────────────
\echo ''
\echo '═══════════════════════════════════════════════════════════════════'
\echo ' 3. ENGAGEMENT SOCIAL'
\echo '═══════════════════════════════════════════════════════════════════'

\echo ''
\echo '--- 3.1 Follows — totaux et moyenne par utilisateur ---'
SELECT
  COUNT(*) AS follows_total,
  COUNT(DISTINCT follower_id) AS utilisateurs_qui_suivent,
  COUNT(DISTINCT followed_id) AS utilisateurs_suivis,
  ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT follower_id), 0), 2) AS moy_follows_par_suiveur
FROM user_follows;

\echo ''
\echo '--- 3.2 Top 15 utilisateurs les plus suivis ---'
SELECT
  followed_id AS user_id,
  u.username,
  COUNT(*) AS followers
FROM user_follows f
LEFT JOIN users u ON u.id = f.followed_id
GROUP BY followed_id, u.username
ORDER BY followers DESC
LIMIT 15;

\echo ''
\echo '--- 3.3 Favoris hôte (user_favorites) ---'
SELECT
  COUNT(*) AS favoris_total,
  COUNT(DISTINCT fan_id) AS fans_distincts,
  COUNT(DISTINCT host_id) AS hotes_distincts
FROM user_favorites;

\echo ''
\echo '--- 3.4 Cœurs profil (heart_events) — 30 derniers jours ---'
SELECT
  to_timestamp(created_at::double precision / 1000.0) AT TIME ZONE 'Europe/Paris' AS jour,
  COUNT(*) AS coeurs
FROM heart_events
WHERE to_timestamp(created_at::double precision / 1000.0)
      >= (NOW() AT TIME ZONE 'Europe/Paris') - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1 DESC;

\echo ''
\echo '--- 3.5 Matchs musicaux (music_matches) ---'
SELECT
  COUNT(*) AS matchs_total,
  COUNT(*) FILTER (
    WHERE to_timestamp(created_at::double precision / 1000.0)
          >= (NOW() AT TIME ZONE 'Europe/Paris') - INTERVAL '30 days'
  ) AS matchs_30j
FROM music_matches;

\echo ''
\echo '--- 3.6 Notifications — volume par type ---'
SELECT
  type,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE read = FALSE) AS non_lues
FROM notifications
GROUP BY type
ORDER BY total DESC;

\echo ''
\echo '--- 3.7 Notifications créées par jour (14 jours) ---'
SELECT
  to_timestamp(created_at::double precision / 1000.0) AT TIME ZONE 'Europe/Paris' AS jour,
  COUNT(*) AS notifications
FROM notifications
WHERE to_timestamp(created_at::double precision / 1000.0)
      >= (NOW() AT TIME ZONE 'Europe/Paris') - INTERVAL '14 days'
GROUP BY 1
ORDER BY 1 DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. MESSAGERIE (DM & GROUPES)
-- ─────────────────────────────────────────────────────────────────────────────
\echo ''
\echo '═══════════════════════════════════════════════════════════════════'
\echo ' 4. MESSAGERIE (DM & GROUPES)'
\echo '═══════════════════════════════════════════════════════════════════'

\echo ''
\echo '--- 4.1 Messages directs — totaux ---'
SELECT
  COUNT(*) AS messages_total,
  COUNT(*) FILTER (WHERE (payload->>'accepted')::boolean IS NOT FALSE) AS acceptes,
  COUNT(*) FILTER (WHERE (payload->>'accepted')::boolean IS FALSE) AS non_acceptes,
  COUNT(DISTINCT sender_id) AS expediteurs_distincts,
  COUNT(DISTINCT receiver_id) AS destinataires_distincts
FROM direct_messages;

\echo ''
\echo '--- 4.2 Messages directs par jour (14 jours) ---'
SELECT
  to_timestamp(timestamp::double precision / 1000.0) AT TIME ZONE 'Europe/Paris' AS jour,
  COUNT(*) AS messages
FROM direct_messages
WHERE to_timestamp(timestamp::double precision / 1000.0)
      >= (NOW() AT TIME ZONE 'Europe/Paris') - INTERVAL '14 days'
GROUP BY 1
ORDER BY 1 DESC;

\echo ''
\echo '--- 4.3 Paires DM en attente d''acceptation ---'
SELECT
  status,
  COUNT(*) AS paires
FROM dm_pending_pairs
GROUP BY status
ORDER BY paires DESC;

\echo ''
\echo '--- 4.4 Groupes de discussion ---'
SELECT
  COUNT(*) AS groupes_total,
  ROUND(AVG(jsonb_array_length(COALESCE(payload->'memberIds', '[]'::jsonb)))::numeric, 1) AS membres_moyen
FROM message_groups;

\echo ''
\echo '--- 4.5 Messages de groupe par jour (14 jours) ---'
SELECT
  to_timestamp(timestamp_col::double precision / 1000.0) AT TIME ZONE 'Europe/Paris' AS jour,
  COUNT(*) AS messages
FROM group_messages
WHERE to_timestamp(timestamp_col::double precision / 1000.0)
      >= (NOW() AT TIME ZONE 'Europe/Paris') - INTERVAL '14 days'
GROUP BY 1
ORDER BY 1 DESC;

\echo ''
\echo '--- 4.6 Messages salon (salon_chats JSONB) ---'
SELECT
  COUNT(*) AS salons_avec_chat,
  COALESCE(SUM(jsonb_array_length(messages)), 0) AS messages_chat_salon_total
FROM salon_chats;

\echo ''
\echo '--- 4.7 Messages live (live_chats JSONB) ---'
SELECT
  COUNT(*) AS lives_avec_chat,
  COALESCE(SUM(jsonb_array_length(messages)), 0) AS messages_chat_live_total
FROM live_chats;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. SALONS & LIVES
-- ─────────────────────────────────────────────────────────────────────────────
\echo ''
\echo '═══════════════════════════════════════════════════════════════════'
\echo ' 5. SALONS & LIVES'
\echo '═══════════════════════════════════════════════════════════════════'

\echo ''
\echo '--- 5.1 Salons — synthèse ---'
SELECT
  COUNT(*) AS salons_total,
  COUNT(*) FILTER (WHERE is_active = TRUE) AS actifs,
  COUNT(*) FILTER (WHERE is_active = FALSE) AS inactifs,
  COUNT(DISTINCT host_id) AS hotes_distincts,
  COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL) AS avec_geo
FROM salons;

\echo ''
\echo '--- 5.2 Salons créés par jour (30 jours) ---'
SELECT
  to_timestamp(created_at::double precision / 1000.0) AT TIME ZONE 'Europe/Paris' AS jour,
  COUNT(*) AS salons_crees
FROM salons
WHERE to_timestamp(created_at::double precision / 1000.0)
      >= (NOW() AT TIME ZONE 'Europe/Paris') - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1 DESC;

\echo ''
\echo '--- 5.3 Top 10 hôtes de salons ---'
SELECT
  host_id,
  u.username,
  COUNT(*) AS salons_crees
FROM salons s
LEFT JOIN users u ON u.id = s.host_id
GROUP BY host_id, u.username
ORDER BY salons_crees DESC
LIMIT 10;

\echo ''
\echo '--- 5.4 File d''attente & propositions de morceaux ---'
SELECT
  (SELECT COUNT(*) FROM salon_queues) AS morceaux_file_attente,
  (SELECT COUNT(*) FROM salon_proposals) AS propositions_total,
  (SELECT COUNT(*) FROM salon_proposals WHERE status = 'pending') AS propositions_en_attente,
  (SELECT COUNT(*) FROM salon_proposals WHERE status = 'accepted') AS propositions_acceptees;

\echo ''
\echo '--- 5.5 Lives — synthèse ---'
SELECT
  COUNT(*) AS lives_total,
  COUNT(*) FILTER (WHERE is_active = TRUE) AS actifs,
  COUNT(*) FILTER (WHERE salon_id IS NOT NULL) AS lies_a_un_salon,
  COUNT(*) FILTER (WHERE salon_id IS NULL) AS autonomes,
  COUNT(DISTINCT host_id) AS hotes_distincts
FROM lives;

\echo ''
\echo '--- 5.6 Lives démarrés par jour (30 jours) ---'
SELECT
  to_timestamp(started_at::double precision / 1000.0) AT TIME ZONE 'Europe/Paris' AS jour,
  COUNT(*) AS lives_demarres
FROM lives
WHERE to_timestamp(started_at::double precision / 1000.0)
      >= (NOW() AT TIME ZONE 'Europe/Paris') - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1 DESC;

\echo ''
\echo '--- 5.7 Plateforme musicale des salons (payload.platform) ---'
SELECT
  COALESCE(payload->>'platform', '(inconnu)') AS plateforme,
  COUNT(*) AS salons
FROM salons
GROUP BY 1
ORDER BY salons DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. CONTENU — FIL D'ACTUALITÉ & STORIES
-- ─────────────────────────────────────────────────────────────────────────────
\echo ''
\echo '═══════════════════════════════════════════════════════════════════'
\echo ' 6. CONTENU — FIL D''ACTUALITÉ & STORIES'
\echo '═══════════════════════════════════════════════════════════════════'

\echo ''
\echo '--- 6.1 Publications feed — synthèse ---'
SELECT
  COUNT(*) AS posts_total,
  COUNT(*) FILTER (WHERE is_event = TRUE) AS evenements,
  COUNT(*) FILTER (WHERE is_event IS NOT TRUE) AS posts_classiques,
  COUNT(*) FILTER (WHERE payload->>'resharedFromId' IS NOT NULL) AS reposts,
  COUNT(DISTINCT user_id) AS auteurs_distincts
FROM feed_posts;

\echo ''
\echo '--- 6.2 Publications par jour (30 jours) ---'
SELECT
  to_timestamp(created_at::double precision / 1000.0) AT TIME ZONE 'Europe/Paris' AS jour,
  COUNT(*) AS publications
FROM feed_posts
WHERE created_at IS NOT NULL
  AND to_timestamp(created_at::double precision / 1000.0)
      >= (NOW() AT TIME ZONE 'Europe/Paris') - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1 DESC;

\echo ''
\echo '--- 6.3 Engagement feed (likes, commentaires, favoris) ---'
SELECT
  (SELECT COUNT(*) FROM feed_post_likes) AS likes,
  (SELECT COUNT(*) FROM feed_post_comments) AS commentaires,
  (SELECT COUNT(*) FROM feed_post_favorites) AS favoris_posts,
  (SELECT COUNT(DISTINCT post_id) FROM feed_post_likes) AS posts_avec_like,
  (SELECT COUNT(DISTINCT post_id) FROM feed_post_comments) AS posts_avec_commentaire;

\echo ''
\echo '--- 6.4 Stories — synthèse ---'
SELECT
  COUNT(*) AS stories_total,
  COUNT(*) FILTER (WHERE expires_at_ts > (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint) AS actives,
  COUNT(*) FILTER (WHERE expires_at_ts <= (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint) AS expirees,
  COUNT(DISTINCT user_id) AS auteurs_distincts
FROM stories;

\echo ''
\echo '--- 6.5 Stories publiées par jour (14 jours) ---'
SELECT
  to_timestamp(((payload->>'createdAt')::bigint)::double precision / 1000.0)
    AT TIME ZONE 'Europe/Paris' AS jour,
  COUNT(*) AS stories
FROM stories
WHERE (payload->>'createdAt') IS NOT NULL
  AND to_timestamp(((payload->>'createdAt')::bigint)::double precision / 1000.0)
      >= (NOW() AT TIME ZONE 'Europe/Paris') - INTERVAL '14 days'
GROUP BY 1
ORDER BY 1 DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. REELS
-- ─────────────────────────────────────────────────────────────────────────────
\echo ''
\echo '═══════════════════════════════════════════════════════════════════'
\echo ' 7. REELS'
\echo '═══════════════════════════════════════════════════════════════════'
\echo '(Tables PG — peuvent être vides si persistance reels pas encore synchronisée)'

\echo ''
\echo '--- 7.1 Reels — synthèse ---'
SELECT
  COUNT(*) AS reels_total,
  COUNT(*) FILTER (WHERE visibility = 'public') AS publics,
  COUNT(*) FILTER (WHERE visibility <> 'public') AS prives,
  COUNT(DISTINCT author_id) AS auteurs_distincts
FROM user_reels;

\echo ''
\echo '--- 7.2 Reels publiés par jour (30 jours) ---'
SELECT
  to_timestamp(created_at::double precision / 1000.0) AT TIME ZONE 'Europe/Paris' AS jour,
  COUNT(*) AS reels
FROM user_reels
WHERE to_timestamp(created_at::double precision / 1000.0)
      >= (NOW() AT TIME ZONE 'Europe/Paris') - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1 DESC;

\echo ''
\echo '--- 7.3 Engagement reels (likes, commentaires, partages, vues) ---'
SELECT
  (SELECT COUNT(*) FROM reel_likes) AS likes,
  (SELECT COUNT(*) FROM reel_comments) AS commentaires,
  (SELECT COUNT(*) FROM reel_shares) AS partages,
  (SELECT COUNT(*) FROM reel_views) AS vues_uniques,
  (SELECT COUNT(DISTINCT reel_id) FROM reel_views) AS reels_vus;

\echo ''
\echo '--- 7.4 Top 10 reels par likes ---'
SELECT
  rl.reel_id,
  COUNT(*) AS likes
FROM reel_likes rl
GROUP BY rl.reel_id
ORDER BY likes DESC
LIMIT 10;

\echo ''
\echo '--- 7.5 Genres reels (payload.genre) ---'
SELECT
  COALESCE(payload->>'genre', '(non renseigné)') AS genre,
  COUNT(*) AS reels
FROM user_reels
GROUP BY 1
ORDER BY reels DESC
LIMIT 15;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. MONÉTISATION
-- ─────────────────────────────────────────────────────────────────────────────
\echo ''
\echo '═══════════════════════════════════════════════════════════════════'
\echo ' 8. MONÉTISATION'
\echo '═══════════════════════════════════════════════════════════════════'

\echo ''
\echo '--- 8.1 Abonnements créateur / Soundy+ ---'
SELECT
  status,
  target_type,
  COUNT(*) AS nombre
FROM creator_subscriptions
GROUP BY status, target_type
ORDER BY nombre DESC;

\echo ''
\echo '--- 8.2 Abonnements actifs par créateur (top 10) ---'
SELECT
  creator_id,
  COUNT(*) AS abonnes_actifs
FROM creator_subscriptions
WHERE status = 'active'
GROUP BY creator_id
ORDER BY abonnes_actifs DESC
LIMIT 10;

\echo ''
\echo '--- 8.3 Checkouts abonnement (subscription_checkouts) ---'
SELECT
  status,
  COUNT(*) AS nombre
FROM subscription_checkouts
GROUP BY status
ORDER BY nombre DESC;

\echo ''
\echo '--- 8.4 Cadeaux live (gifts) ---'
SELECT
  gift_type,
  COUNT(*) AS nombre,
  COALESCE(SUM(amount), 0) AS montant_total_unites
FROM gifts
GROUP BY gift_type
ORDER BY nombre DESC;

\echo ''
\echo '--- 8.5 Dons Stripe (donation_payments) ---'
SELECT
  status,
  COUNT(*) AS transactions,
  COALESCE(SUM(amount_cents), 0) AS total_cents
FROM donation_payments
GROUP BY status
ORDER BY transactions DESC;

\echo ''
\echo '--- 8.6 Notes hôtes (host_ratings) ---'
SELECT
  COUNT(*) AS notes_total,
  ROUND(AVG(stars)::numeric, 2) AS moyenne_etoiles,
  COUNT(DISTINCT host_id) AS hotes_notes,
  COUNT(DISTINCT rater_id) AS evaluateurs
FROM host_ratings;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. MODÉRATION & ACCÈS
-- ─────────────────────────────────────────────────────────────────────────────
\echo ''
\echo '═══════════════════════════════════════════════════════════════════'
\echo ' 9. MODÉRATION & ACCÈS'
\echo '═══════════════════════════════════════════════════════════════════'

\echo ''
\echo '--- 9.1 Comptes en attente de validation (pending) ---'
SELECT
  id,
  username,
  email,
  to_timestamp(((payload->>'memberSince')::bigint)::double precision / 1000.0)
    AT TIME ZONE 'Europe/Paris' AS inscrit_le
FROM users
WHERE account_status = 'pending'
  AND id NOT LIKE 'bot\_%' ESCAPE '\'
ORDER BY (payload->>'memberSince')::bigint DESC
LIMIT 25;

\echo ''
\echo '--- 9.2 Blocages & muettes ---'
SELECT
  (SELECT COUNT(*) FROM user_blocks) AS blocages,
  (SELECT COUNT(DISTINCT blocker_id) FROM user_blocks) AS utilisateurs_qui_bloquent,
  (SELECT COUNT(*) FROM user_mutes) AS muettes,
  (SELECT COUNT(DISTINCT muter_id) FROM user_mutes) AS utilisateurs_qui_mettent_en_mute;

\echo ''
\echo '--- 9.3 Bans live & salon ---'
SELECT
  (SELECT COUNT(*) FROM live_bans) AS bans_live,
  (SELECT COUNT(DISTINCT live_id) FROM live_bans) AS lives_avec_ban,
  (SELECT COUNT(*) FROM salon_bans) AS bans_salon,
  (SELECT COUNT(DISTINCT salon_id) FROM salon_bans) AS salons_avec_ban;

\echo ''
\echo '--- 9.4 Politique d''inscription (access_policy) ---'
SELECT
  registration_mode AS mode_inscription,
  to_timestamp(updated_at::double precision / 1000.0) AT TIME ZONE 'Europe/Paris' AS maj_le
FROM access_policy
WHERE id = 1;

\echo ''
\echo '--- 9.5 Codes d''invitation actifs ---'
SELECT COUNT(*) AS codes_invitation
FROM access_invite_codes;

\echo ''
\echo '--- 9.6 Signalements de contenu (hors base PostgreSQL) ---'
\echo 'Les signalements sont stockés dans : /opt/soundy/data/content-reports.jsonl'
\echo 'Comptage rapide sur le VPS : wc -l /opt/soundy/data/content-reports.jsonl'

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. MÉTA & SANTÉ BASE
-- ─────────────────────────────────────────────────────────────────────────────
\echo ''
\echo '═══════════════════════════════════════════════════════════════════'
\echo ' 10. MÉTA & SANTÉ BASE'
\echo '═══════════════════════════════════════════════════════════════════'

\echo ''
\echo '--- 10.1 Migrations appliquées ---'
SELECT version, applied_at AT TIME ZONE 'Europe/Paris' AS appliquee_le
FROM schema_migrations
ORDER BY version;

\echo ''
\echo '--- 10.2 Dernière sauvegarde store_meta ---'
SELECT
  version,
  to_timestamp(saved_at::double precision / 1000.0) AT TIME ZONE 'Europe/Paris' AS sauvegarde_le
FROM store_meta
WHERE id = 1;

\echo ''
\echo '--- 10.3 Taille des tables principales (estimation PostgreSQL) ---'
SELECT
  relname AS table_name,
  n_live_tup AS lignes_estimees,
  pg_size_pretty(pg_total_relation_size(relid)) AS taille_totale
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname IN (
    'users', 'direct_messages', 'message_groups', 'group_messages',
    'salons', 'lives', 'feed_posts', 'stories', 'user_reels',
    'notifications', 'user_follows', 'heart_events', 'music_matches'
  )
ORDER BY pg_total_relation_size(relid) DESC;

\echo ''
\echo '═══════════════════════════════════════════════════════════════════'
\echo ' FIN — stats-app-db.sql'
\echo '═══════════════════════════════════════════════════════════════════'
