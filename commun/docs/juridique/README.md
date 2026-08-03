# Juridique — documentation validation

| Ressource | Description |
|-----------|-------------|
| [`COMPARATIF-JURIDIQUE-TIKTOK-INSTAGRAM.md`](./COMPARATIF-JURIDIQUE-TIKTOK-INSTAGRAM.md) | Audit CTO : dossier vs TikTok / Instagram · manquements |
| [`DOSSIER-AVOCAT-LISEZMOI.md`](./DOSSIER-AVOCAT-LISEZMOI.md) | Guide du pack avocat (source du PDF `00-LISEZMOI`) |
| [`CHECKLIST-VALIDATION-AVOCAT.md`](./CHECKLIST-VALIDATION-AVOCAT.md) | Checklist (source du PDF `00-CHECKLIST`) |
| [`dossier-avocat-a-valider/`](./dossier-avocat-a-valider/) | **PDF uniquement** — dossier à transmettre à l’avocat |
| [`RENDEZ-VOUS-AVOCAT.md`](./RENDEZ-VOUS-AVOCAT.md) | Fiche RDV avocat |
| [`MENTIONS-LEGALES-DONS.md`](./MENTIONS-LEGALES-DONS.md) | Pourboires / commission |

## Régénérer les PDF

```powershell
npm install --prefix commun/docs/juridique
npm run dossier-avocat --prefix commun/docs/juridique
```

Le Markdown intermédiaire est écrit dans `_build-dossier-avocat/` (gitignored).
