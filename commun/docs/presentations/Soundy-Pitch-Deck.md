# Soundy — Pitch Deck

*Document investisseur · getsoundy.com · Juin 2025*

---
## Slide 1 — Soundy
- **Le réseau social de la musique live et de l'écoute partagée**
- PWA mobile-first déjà en production sur [getsoundy.com](https://getsoundy.com)
- Hébergement France (Scaleway) · UI française · communauté musique & événements
- *Speaker notes : Accroche en 10 s — « Soundy réunit ce que les fans dispersent entre TikTok, Spotify et Shotgun, dans une seule app pensée pour la musique. »*

---
## Slide 2 — Le problème
- **Fragmentation** : découverte (TikTok), écoute (Spotify), social (Instagram), sorties (Shotgun/Facebook) — aucun parcours unifié
- **Créateurs mid-tier sous-outillés** : DJs, collectifs et bars 50–500 places sans hub communautaire entre deux dates
- **Monétisation déconnectée** : pas de pourboires live ni d'écoute synchronisée dans un contexte musique + géolocalisation
- **Découverte locale faible** : les agendas ne sont pas sociaux ; les réseaux sociaux ne cartographient pas « qui sort où ce soir »
- *Speaker notes : Insister sur Léa (24 ans, fan électro) qui jongle entre 4 apps chaque week-end.*

---
## Slide 3 — La solution Soundy
- **Une PWA sociale musicale** qui couvre découverte → écoute ensemble → live → sortie IRL
- **5 onglets** : Actualités · Carte · Direct · Messages · Reels
- **Déjà live** sur getsoundy.com — pas une maquette, infrastructure prod opérationnelle
- Proposition : *retrouver sa communauté musicale là où elle se crée réellement*
- *Speaker notes : Montrer l'app en direct — navigation 5 onglets + un salon ouvert.*

---
## Slide 4 — Produit (features en production)
- **Salons** YouTube synchronisés — public ou privé, file d'attente, chat, ancrage carte
- **Direct (Live)** — vidéo LiveKit/Cloudflare HLS, chat, pourboires Stripe Connect (30 %), abonnements créateur
- **Actualités + Stories + Reels** — feed social, algo Soundy, reels sponsorisés (1/5 par défaut)
- **Carte** — événements, salons, personnes proches, bannières sponsor `map_banner`
- **Admin sponsors** — 4 emplacements natifs (carte, feed, stories, reels) déjà codés
- *Speaker notes : Chaque bullet = une démo rapide si possible (salon → live → carte event).*

---
## Slide 5 — Marché & personas
- **Géographie** : France d'abord (Paris, Lyon, Marseille, Lille, Bordeaux…), puis diaspora francophone
- **SAM France** *(hyp.)* : 8–12 M personnes 16–35 ans musique + réseaux + sorties ; 500 k–1 M early adopters à 24 mois
- **Léa** (fan 24 ans) — carte + salons + reels pour sorties du week-end
- **Karim** (DJ 29 ans) — live + pourboires + profil + notation hôte
- **Sophie** (gérante bar) — événements carte/feed + visibilité locale
- *Speaker notes : Concentration géographique = effet réseau plus rapide qu'un lancement global.*

---
## Slide 6 — Modèle économique
- **Sponsors natifs** *(priorité court terme)* — carte 800–2 000 €/mois, pack feed+stories 1 500–4 000 €, reels 2 000–8 000 €, takeover 5 000–15 000 €
- **Commissions créateurs** — pourboires live (30 % plateforme), abonnements Supporter/Super fan (4,99–9,99 €/mois)
- **Soundy+** — abonnement plateforme 2,99–4,99 €/mois (badge, filtres carte, moins de sponsors)
- **B2B lieux** *(roadmap M7–M9)* — Soundy Pro Lieu 49–149 €/mois
- Répartition cible M24 *(hyp.)* : sponsors 45–55 % · commissions 25–35 % · Soundy+ 10–15 % · B2B 5–15 %
- *Speaker notes : Revenus avant scale via sponsors locaux + tips dès les premiers créateurs actifs.*

---
## Slide 7 — Traction & objectifs M12
- **Produit** : PWA en prod, Stripe Connect, admin sponsors, salons/live/reels opérationnels
- **Objectifs M12** *(hypothèses)* :
  - 15 000 MAU · DAU/MAU 25 % · rétention J30 15 %
  - 200 salons actifs/semaine · 50 lives/semaine (>10 min)
  - 40 k€ ARR sponsors · 30 créateurs monétisés (Stripe Connect actif)
- **90 prochains jours** : 30–50 créateurs pilotes · 2 sponsors fondateurs · 1 ville dense
- *Speaker notes : Remplacer par données réelles dès disponibles — dashboard interne + contrats sponsors.*

---
## Slide 8 — Go-to-market
- **M0–M3** — Fondations : 30–50 créateurs pilotes, 2 sponsors fondateurs, campagne « Premiers salons »
- **M4–M12** — Densité : playbooks Paris + Lyon/Marseille, 5 lieux/ville, challenges reels #SoundyReel, 5–8 contrats sponsors récurrents
- **M13–M24** — Monétisation : Soundy Pro Lieu (10–30 établissements), sales marques, expansion diaspora
- **Canaux** : créateurs (organique) → lieux B2B → micro-influence → paid social après M12
- CAC cible *(hyp.)* : < 3 € B2C · < 150 € B2B lieu
- *Speaker notes : La densité par ville bat la croissance large prématurée.*

---
## Slide 9 — Concurrence & différenciation
| Acteur | Limite vs. Soundy | Position Soundy |
|--------|-------------------|-----------------|
| Instagram / TikTok | Pas d'écoute sync, pas de carte events musique | Verticalisation musique + salons + carte |
| Spotify | Social faible, pas de live vidéo intégré | Couche sociale & live au-dessus du streaming |
| Discord | Friction, pas mobile-first grand public | UX grand public, carte, reels |
| Shotgun / RA | Peu social, pas d'écoute partagée | Pont social → sortie IRL |
- **Moat progressif** : données social + geo + écoute · monétisation créateur intégrée · ancrage local FR/EU
- *Speaker notes : Soundy ne remplace pas Spotify — il socialise l'écoute et l'événementiel.*

---
## Slide 10 — Équipe & opérations
- **Produit / Tech** — full-stack opérationnel (React PWA, Node, PostgreSQL, WebSocket, LiveKit)
- **Ops / Infra** — VPS Scaleway, runbook prod, modération admin, Stripe (tips, Connect, Billing)
- **Recrutements prévus** :
  - Community manager musique (M6)
  - Account executive sponsors (M10)
  - Support / modération mi-temps (M12)
- Burn additionnel estimé *(hyp.)* : 120–180 k€/an pour ces 3 rôles
- *Speaker notes : Risque tech réduit — le capital sert surtout distribution et sales.*

---
## Slide 11 — Finances (scénario base)
| | An 1 | An 2 | An 3 |
|---|------|------|------|
| MAU fin période | 12 000 | 35 000 | 80 000 |
| Revenu total | ~65 k€ | ~240 k€ | ~626 k€ |
| Charges | 100 k€ | 200 k€ | 350 k€ |
| Résultat net | -35 k€ | +40 k€ | +276 k€ |
- Break-even ~An 2 · ARPU blended M24 *(hyp.)* : ~0,34 €/MAU/mois
- Infra : 0,15–0,35 €/MAU/mois à 50 k MAU · LTV/CAC cible > 3 à M24
- *Speaker notes : Trois scénarios (conservateur / base / ambitieux) disponibles en annexe — projections étiquetées « hypothèse ».*

---
## Slide 12 — La demande & contact
- **Levée visée** : **190–280 k€** seed · horizon 18 mois
- **Utilisation des fonds** :
  - 40 % — Growth & communauté créateurs
  - 30 % — Commercialisation sponsors & lieux
  - 20 % — Produit (analytics, onboarding, polish)
  - 10 % — Ops & conformité
- **Jalons Series A** *(hyp.)* : 50 k+ MAU · 150 k€+ ARR mixte · 100+ créateurs monétisés · 3+ villes FR
- **Contact** : [fondateur] · [getsoundy.com](https://getsoundy.com) · deck & data room sur demande
- *Speaker notes : SAFE ou equity 10–18 % selon traction au closing — à négocier.*
