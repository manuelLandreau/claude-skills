---
name: dailysum
description: Builds the user's daily standup summary, ready to paste in Slack. Use when the user asks for their daily, dailysum, standup recap, or "what did I do yesterday". One line per ticket (PROJ-123 - short description : status) plus short lines for untracked work, with emojis.
---

# Dailysum

Lecture seule. Ne rien écrire sur GitHub ni Jira.

## Période

Par défaut : depuis le dernier jour ouvré à 00:00 (lundi → vendredi). Un argument (`depuis lundi`, `2026-09-28`…) l'écrase.

```bash
S=$(date -v-1d +%F); [ "$(date +%u)" = 1 ] && S=$(date -v-3d +%F)
```

## Collecte (dans le repo courant)

```bash
# Mes PRs touchées sur la période
gh search prs --repo "$(gh repo view --json nameWithOwner -q .nameWithOwner)" --author @me --updated ">=$S" \
  --json number,title,state,isDraft,closedAt --limit 50
# PRs des autres que j'ai reviewées
gh search prs --repo "$(gh repo view --json nameWithOwner -q .nameWithOwner)" --reviewed-by @me --updated ">=$S" \
  --json number,title,author --limit 50 -- -author:@me
# Mes commits sur la période, toutes branches (y compris celles sans PR)
git log --all --author="$(git config user.email)" --since="$S 00:00" --format='%h %s | %D'
```

## Statut

| Cas | Statut |
|-----|--------|
| PR mergée (`closedAt` ≥ S) | ✅ Merged |
| PR ouverte, pas draft | 👀 CR |
| PR draft, ou commits sans PR | 🚧 WIP |
| PR fermée sans merge | ❌ Closed |

Une PR mergée avant S mais juste commentée sur la période : l'ignorer.

## Rendu

- Clé ticket depuis le titre de PR (`#PROJ-123`) ou le nom de branche. Une ligne par ticket ; si plusieurs PRs, statut le moins avancé.
- Description : 3 à 6 mots, en français, depuis le titre de PR. Pas de préfixe conventional commit.
- Un commit déjà couvert par une PR listée ne fait pas de ligne en plus.
- Lignes non ticketées : reviews (`🔍 Review #1234 - <sujet>`), commits sans ticket (docs, recette, investigation, CI) regroupés par sujet. Très court aussi.
- Rien d'autre : pas de titre, pas de date, pas de lien, pas de résumé.

```
✅ PROJ-123 - Export CSV des commandes : Merged
👀 PROJ-124 - Filtre par organisation : CR
🚧 PROJ-125 - Relance mail automatique : WIP
🔍 Review #456 - changelog 2.3
📝 Doc de recette
```

Afficher le bloc, puis le copier : `pbcopy <<'EOF' ... EOF`. Si rien sur la période, le dire en une ligne.
