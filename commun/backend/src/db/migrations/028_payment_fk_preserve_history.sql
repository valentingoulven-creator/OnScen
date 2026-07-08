-- 028: Préserve l'historique financier/comptable des paiements à la suppression
-- d'un compte utilisateur.
--
-- Contexte (audit DB/infra §2 — Critical) : les FK ajoutées en migration 025
-- (et validées en 026) utilisent ON DELETE CASCADE vers users(id) sur
-- donation_payments.sender_id, creator_subscriptions.subscriber_id/creator_id
-- et subscription_checkouts.subscriber_id. Une suppression de compte détruisait
-- donc silencieusement tout l'historique de paiement/abonnement Stripe associé
-- — problématique légale/comptable (obligation de conservation des pièces
-- justificatives de paiement même après suppression du compte client).
--
-- Fix : bascule ON DELETE CASCADE → ON DELETE SET NULL sur ces 4 FK (les
-- lignes de paiement/abonnement survivent, seule la référence à l'utilisateur
-- supprimé est effacée — équivalent à une anonymisation). Nécessite de rendre
-- les colonnes nullable au préalable.
--
-- Voir aussi lib/accountDeletionPg.ts (purgeUserAccountFromPg) qui supprimait
-- explicitement ces lignes par requête DELETE avant même que la CASCADE ne
-- s'applique : corrigé en parallèle de cette migration pour ne plus détruire
-- ces lignes (elles seront désormais mises à jour via SET NULL par PostgreSQL
-- lors de la suppression de l'utilisateur).
--
-- NOT VALID : évite un scan complet bloquant si la table grossit en prod ; les
-- lignes existantes ont déjà été validées sans orphelin en migration 026, donc
-- une VALIDATE CONSTRAINT immédiate est sans risque mais volontairement
-- différée (cohérent avec le pattern déjà utilisé en 025/026).

ALTER TABLE donation_payments ALTER COLUMN sender_id DROP NOT NULL;
ALTER TABLE creator_subscriptions ALTER COLUMN subscriber_id DROP NOT NULL;
ALTER TABLE creator_subscriptions ALTER COLUMN creator_id DROP NOT NULL;
ALTER TABLE subscription_checkouts ALTER COLUMN subscriber_id DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'donation_payments_sender_fk' AND confdeltype = 'c'
  ) THEN
    ALTER TABLE donation_payments DROP CONSTRAINT donation_payments_sender_fk;
    ALTER TABLE donation_payments
      ADD CONSTRAINT donation_payments_sender_fk
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'creator_subscriptions_subscriber_fk' AND confdeltype = 'c'
  ) THEN
    ALTER TABLE creator_subscriptions DROP CONSTRAINT creator_subscriptions_subscriber_fk;
    ALTER TABLE creator_subscriptions
      ADD CONSTRAINT creator_subscriptions_subscriber_fk
      FOREIGN KEY (subscriber_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'creator_subscriptions_creator_fk' AND confdeltype = 'c'
  ) THEN
    ALTER TABLE creator_subscriptions DROP CONSTRAINT creator_subscriptions_creator_fk;
    ALTER TABLE creator_subscriptions
      ADD CONSTRAINT creator_subscriptions_creator_fk
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscription_checkouts_subscriber_fk' AND confdeltype = 'c'
  ) THEN
    ALTER TABLE subscription_checkouts DROP CONSTRAINT subscription_checkouts_subscriber_fk;
    ALTER TABLE subscription_checkouts
      ADD CONSTRAINT subscription_checkouts_subscriber_fk
      FOREIGN KEY (subscriber_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

-- Après vérification en prod (aucun orphelin attendu, déjà validé en 026) :
-- ALTER TABLE donation_payments VALIDATE CONSTRAINT donation_payments_sender_fk;
-- ALTER TABLE creator_subscriptions VALIDATE CONSTRAINT creator_subscriptions_subscriber_fk;
-- ALTER TABLE creator_subscriptions VALIDATE CONSTRAINT creator_subscriptions_creator_fk;
-- ALTER TABLE subscription_checkouts VALIDATE CONSTRAINT subscription_checkouts_subscriber_fk;
