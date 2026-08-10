# Cursor — règles @onscen introuvables

## Symptôme

Dans le chat Agent, taper `@onscen` ne propose **aucune** règle.

## Cause la plus fréquente

Cursor n’a **pas** le bon dossier projet ouvert. Les règles vivent uniquement ici :

```text
c:\Dev\Soundy\.cursor\rules\*.mdc
```

Si la fenêtre Cursor est ouverte sur un autre chemin (sous-dossier seul, copie temporaire, autre clone sans `.cursor`), le menu `@` ne listera **rien** pour OnScen.

## Correctifs (dans l’ordre)

1. **File → Open Folder…** → choisir **`c:\Dev\Soundy`** (pas `web\app` seul).
2. Ou ouvrir **`OnScen-CEO-IA.code-workspace`** à la racine du repo.
3. **Cursor Settings → Rules → Project Rules** : tu dois voir ~8 fichiers (`onscen-cto`, `onscen-dev`, `onscen-dev-agent`, etc.).  
   - Si la liste est vide → mauvais workspace (retour étape 1).
4. Dans le chat Agent : taper **`@`** puis choisir la catégorie **Rules** (parfois la recherche ne filtre qu’après).
5. **Developer: Reload Window** (`Ctrl+Shift+P`).
6. Lancer Cursor depuis la racine : `cursor c:\Dev\Soundy` (PowerShell).

## Mentions valides

| Besoin | Taper / choisir |
|--------|------------------|
| CTO | `@onscen-cto` |
| Dev (court) | `@onscen-dev` |
| Dev (complet) | `@onscen-dev-agent` |
| CEO | `@onscen-ceo-ia` |

Anciennes mentions **`@soundy-*`** : supprimées au rebrand OnScen.

## Contournement si le picker reste vide

Coller en tête du message :

```markdown
Suis la règle projet `.cursor/rules/onscen-dev-agent.mdc` (ou onscen-cto.mdc) pour toute cette conversation.
```

Puis décrire la mission.

## Vérification rapide (PowerShell)

```powershell
Test-Path c:\Dev\Soundy\.cursor\rules\onscen-cto.mdc
Test-Path c:\Dev\Soundy\.cursor\rules\onscen-dev.mdc
Get-ChildItem c:\Dev\Soundy\.cursor\rules\*.mdc | Select-Object Name
```

Les deux `Test-Path` doivent afficher `True`.

## Doc complète

[`docs/CURSOR-AGENT-CONFIG.md`](../../docs/CURSOR-AGENT-CONFIG.md) · [`AGENTS.md`](../../AGENTS.md)
