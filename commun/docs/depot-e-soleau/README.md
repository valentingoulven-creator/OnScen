# Dépôt e-Soleau INPI — Soundy

## Fichiers

| Fichier | Description |
|---------|-------------|
| **DOSSIER-E-SOLEAU-SOUNDY.pdf** | Document principal à déposer (~horodatage INPI) |
| DOSSIER-E-SOLEAU-SOUNDY.md | Source Markdown (mise à jour future) |
| generate-pdf.mjs | Script de régénération du PDF |
| pdf-style.css | Styles du PDF |

## Régénérer le PDF

```powershell
cd docs\depot-e-soleau
npm install --no-save marked
node generate-pdf.mjs
```

## Déposer sur INPI (e-Soleau)

1. Se connecter sur [https://www.inpi.fr](https://www.inpi.fr) → espace personnel
2. Choisir **e-Soleau** (horodatage électronique)
3. Téléverser **DOSSIER-E-SOLEAU-SOUNDY.pdf**
4. Renseigner un intitulé, par ex. : *« Description intégrale application Soundy — réseau social musical »*
5. Payer la redevance (~15 € en dépôt électronique, tarif 2026)
6. Conserver le **certificat d’horodatage** INPI

## Ce que l’e-Soleau couvre

- Preuve de **date d’existence** du document à la date du dépôt
- **Aucune exclusivité** sur la marque « Soundy » ni sur le code
- Complément utile avant consultation CPI / dépôt de marque distinct

## Prochaines étapes recommandées

- Dépôt de **marque « Soundy »** (classes 9, 38, 41, 42) — démarche séparée
- Consultation **CPI** avec le dossier brevet (`docs/brevet/`)
- Vérifier l’identité de l’éditeur et l’adresse avant tout dépôt au nom d’une société
