# Documents stratégie Soundy

| Fichier | Description |
|---------|-------------|
| `ETUDE-MARCHE-BUSINESS-PLAN-PARTENAIRES.md` / `.pdf` | Étude de marché, business plan 36 mois, partenaires |
| `BUSINESS-PLAN-PREMIUM.md` / `.pdf` / `.html` | Business plan premium investisseurs (18 sections, style cabinet) |
| `ONE-PAGER-SPONSOR-COMMERCIAL.md` / `.pdf` | One-pager commercial sponsors & lieux (bars, festivals) |
| `SOUNDY-MARKETING-PRESENTATION.pptx` | Présentation marketing PowerPoint — thème sombre (16 slides · sponsors, produit, créateurs) |
| `build-marketing-presentation.mjs` | Script de génération du `.pptx` sombre |
| `SOUNDY-PRESENTATION-PRODUIT.html` | Présentation produit interactive (10 slides · promoteur artistes & événements) |
| `SOUNDY-PRESENTATION-PRODUIT.pptx` | Même contenu en PowerPoint (10 slides · compatible Google Slides) |
| `build-produit-presentation.mjs` | Script de génération du `.pptx` produit |
| `build-premium-deck.mjs` | Script de génération du deck premium clair |
| `../presentations/SOUNDY-PRESENTATION.html` | Présentation produit interactive (13 slides · navigateur) |
| `../presentations/Soundy-Presentation.pptx` | Présentation produit FR (13 slides · screenshots) |
| `../presentations/SOUNDY-PRESENTATION-MAIRIES-BARS.html` | Présentation visuelle mairies & bars (14 slides · carte, globe, reels, musique) |
| `../capture-presentation-screenshots.mjs` | Captures mobile prod (`demo-test@getsoundy.com`) — carte, globe, reels, musique |

## Régénérer les PDF

```powershell
cd commun/docs/strategie
npm install
npm run pdf
```

Prérequis : Microsoft Edge (headless).

## Régénérer la présentation PowerPoint marketing

```powershell
cd commun/docs/strategie
npm install
npm run pptx
```

Produit : `SOUNDY-MARKETING-PRESENTATION.pptx` (16 slides, captures `../presentation-screenshots/mobile/`).

## Régénérer le deck premium (style clair)

```powershell
cd commun/docs/strategie
npm install
npm run deck
```

Produit : `SOUNDY-PREMIUM-DECK.pptx` — palette claire, public mixte (clients/partenaires/investisseurs), sans chiffres financiers projetés. Design system Stripe/Notion : icônes vectorielles, mockups device, cartes à accent violet.

## Présentation produit (10 slides · promoteur artistes & événements)

**HTML** (navigateur, plein écran F) :

```
commun/docs/strategie/SOUNDY-PRESENTATION-PRODUIT.html
```

**PowerPoint** :

```powershell
cd commun/docs/strategie
npm run produit
```

Produit : `SOUNDY-PRESENTATION-PRODUIT.pptx` — 10 slides, dimensions 10×5.625" (Google Slides).

| Slide | Contenu |
|-------|---------|
| 1 | Accueil · slogan promoteur artistes & événements |
| 2 | Sommaire |
| 3 | Application (6 espaces) |
| 4 | Globe & carte sombre · pins |
| 5 | Événements · sponsoring · filtres |
| 6 | Salons · YouTube sync · PiP · chat · file d'attente |
| 7 | Lives · chat · dons · artistique |
| 8 | Musique · tendances · découverte · top performeurs |
| 9 | Modèle économique (sans chiffres) |
| 10 | Reels artistiques |
