# Cloudflare — proxy getsoundy.com (config seule)

Guide pour activer le proxy Cloudflare devant le VPS Scaleway **sans accès compte** (à faire par le titulaire du domaine).

## Prérequis

- Domaine `getsoundy.com` géré chez le registrar (ou transféré DNS vers Cloudflare).
- VPS : IP publique `51.159.164.100`, ports 80/443 ouverts, certificat TLS (Let's Encrypt ou Cloudflare Full).

## Étapes (plan Free)

1. Créer un compte [Cloudflare](https://dash.cloudflare.com/sign-up) et ajouter le site `getsoundy.com`.
2. Remplacer les nameservers du registrar par ceux fournis par Cloudflare.
3. DNS → enregistrements :
   - `A` `@` → `51.159.164.100` — **Proxied** (nuage orange)
   - `A` `www` → `51.159.164.100` — **Proxied**
4. SSL/TLS → mode **Full (strict)** si certificat valide sur le VPS, sinon **Full** le temps de corriger le cert.
5. SSL/TLS → Edge Certificates → **Always Use HTTPS** : ON
6. Speed → Optimization → activer compression (Brotli) si disponible sur le plan.

## WebSockets (Socket.io + LiveKit)

- **Network** : WebSockets activés par défaut sur le proxy orange.
- Vérifier que Nginx/Node proxy bien `/socket.io/` vers le backend (déjà en place sur prod).
- LiveKit Cloud : connexion directe vers LiveKit (pas via Cloudflare) — pas de changement.

## Headers utiles (optionnel, règles Transform)

| Header | Valeur | Usage |
|--------|--------|--------|
| `X-Forwarded-For` | (auto Cloudflare) | IP client réelle |
| `CF-Connecting-IP` | (auto) | Rate-limit / logs |

Sur le VPS, s'assurer que Express lit `trust proxy` (déjà configuré si derrière Nginx).

## Quand upgrader (Pro ~$20–25/mo)

- WAF avancé, image optimization, plus de Page Rules.
- Pour une micro-entreprise au lancement : **Free suffit** tant que le trafic < ~500k pageviews/mo et pas de besoin WAF custom.

## Checklist post-activation

- [ ] `https://getsoundy.com/health` OK
- [ ] Connexion / carte / chat salon fonctionnels
- [ ] Pas de boucle de redirection HTTP↔HTTPS
- [ ] PWA : cache service worker OK après purge Cloudflare si besoin
