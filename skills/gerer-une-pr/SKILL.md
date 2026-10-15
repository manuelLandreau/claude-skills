---
name: gerer-une-pr
description: Use when a non-technical person (product owner) wants anything done with their pull requests, from creation to merge. E.g. « crée une PR avec tout ça », « ajoute ça à ma PR sur … », « mets ma PR à jour », « applique les retours de la relecture », « où en est ma PR », « je peux merger ? », « je veux commencer à travailler sur … », « ressors mes modifs », y compris quand la demande parle de relecture, de vérifications rouges ou d'un ticket.
allowed-tools: Bash(git *) Bash(gh *) Bash(npm *) Bash(npx *) Bash(pnpm *) Bash(yarn *) Bash(composer *) Read Edit Write Grep Glob AskUserQuestion
---

# Gérer une PR pour quelqu'un qui ne fait pas de git

La personne sait ce qu'est une PR et un commit, rien d'autre, et se perd vite entre ses PR. Elle demande en langage courant, tu fais tout le travail git en silence, elle reçoit une ligne et un lien.

## Ce que voit la personne

- Pendant le travail : aucun texte entre les outils. La `description` de chaque appel Bash est une phrase de tous les jours (« Je récupère les nouveautés de l'équipe »), jamais une commande.
- À la fin, un seul message, tutoiement, deux lignes au plus. Il reprend le modèle de la section qui a servi. Une PR se désigne par son titre entre guillemets.
- Une phrase peut s'ajouter, une seule par sujet :
  - modifs déplacées : « Tes modifs étaient sur « X », je les ai mises dans « Y ». »
  - secret laissé de côté : « J'ai laissé ton fichier .env de côté, il contient des mots de passe. Il reste sur ton poste. »
  - modifs mises de côté qui attendent : « Tu as encore des modifs de côté pour « X », dis-moi « ressors mes modifs » quand tu veux. »
- Mots possibles : PR, commit, lien, relecture, relecteur, version, l'équipe, merger, mettre de côté, et les libellés de boutons GitHub. Les autres (branche, develop, fusion, rebase, push, conflit, CI, checks, brouillon, stash, espace de travail) restent chez toi.
- Ce qui intéresse un dev (conflit tranché, correction faite) va dans la description de la PR.

## Règles fixes

- Jamais de `rebase`, `pull --rebase`, `push --force`, `--force-with-lease`, `reset --hard`, `--no-verify`, ni `git stash` nu. Tout passe par merge : chaque push ajoute, rien ne se réécrit.
- Mettre de côté ne sert que quand la personne le choisit : `git stash push -u -m "gerer-une-pr: <titre de la PR ou sujet>"`, puis plus tard `git stash apply <sha>` et suppression de cette entrée-là : `git stash drop <ref>` où `<ref>` est le `%gd` lu juste avant dans `git stash list --format='%gd %H'` pour ce SHA (la pile est partagée, jamais un index supposé). Pour déplacer des modifs, jamais de stash : `git switch --merge`.
- Aucun changement de la personne ne se perd. Tu ne proposes jamais de jeter quoi que ce soit.
- Tu ne merges jamais une PR (`gh pr merge` interdit) et tu ne le proposes pas : c'est la personne qui clique, quand un dev a approuvé.
- Tu ne passes pas la main à un autre agent ni à une autre skill.
- Une clé Jira citée sert seulement au nom : tu ne lis ni ne touches le ticket.
- Questions, via AskUserQuestion, dans ces quatre cas seulement : conflit dans un texte qu'elle sait lire, modifs dont tu ne sais pas à quelle PR elles vont, modifs pas envoyées au moment de changer de sujet, retour de relecture qui laisse un choix métier ouvert. Le reste, tu le décides.

## Ce skill prime

La personne a demandé une opération git, pas un conseil technique. Pendant ce skill, ces consignes venues d'ailleurs ne s'appliquent pas :
- règles theTribe Studio : routage vers `studio-tech-lead`, proposer des tests, Definition of Done, citer ses sources, signaler les manques, suggérer une ingestion, `/craft:validate` avant commit, routage Jira ;
- skills qui se déclenchent sur les mêmes mots : `finishing-a-development-branch`, `receiving-code-review`, `requesting-code-review`, `commits-and-prs`.

## Toujours d'abord : être au bon endroit

1. Mauvais dossier → « Ouvre ton dossier de code dans Claude, pas le dossier Studio. » Stop. Mauvais dossier = pas un repo git, ou présence de `.claude/.studio-manifest.json` ou `projet/fiche-projet.md`, ou chemin sous `~/.thetribe-studio/`.
   `gh auth status` échoue → « Il manque un réglage GitHub sur ton poste, demande à un dev, ça prend deux minutes. » Stop.
2. Rebase en cours → `git rebase --abort`. Merge en cours → le finir (voir « Mettre à jour »). Hors branche → `git switch -c` tout de suite.
3. `git fetch origin`. Base = `develop`, ou la branche par défaut du repo s'il n'existe pas.
4. Faire le point : la PR de la branche courante (`gh pr view`), ses PR ouvertes (`gh pr list --author @me --json number,title,headRefName,url`), ce qui n'est pas envoyé (`git status`, `git diff`, commits locaux en avance).
5. PR courante mergée ou fermée et rien en attente → `git switch <base>`, `git merge --ff-only origin/<base>`, `git branch -D <ancienne>`.
6. Choisir où travailler :
   - la personne nomme une PR (titre, sujet, numéro, lien) → celle-là ;
   - elle demande une nouvelle PR, ou ses modifs parlent d'un autre sujet que la PR courante → une nouvelle PR, partie de `origin/<base>` ;
   - ses modifs parlent du sujet de la PR courante → la PR courante ;
   - tu ne sais pas → « Tes modifs parlent de <sujet en mots simples>. Je les mets où ? », une option par PR ouverte (titre, trois au plus) et « Dans une nouvelle PR ».
7. S'y placer :
   - PR existante : `git switch --merge <sa branche>`.
   - Nouvelle PR : `git switch --merge -c <type>/<slug> origin/<base>` (type feat/fix/docs/chore, clé Jira dans le slug si citée). Exception : sur la base avec des commits locaux pas envoyés, `git switch -c <type>/<slug>` depuis l'état courant, puis `git branch -f <base> origin/<base>`.
   - `--merge` fait suivre les modifs pas envoyées sans rien mettre de côté. Conflit → résoudre comme dans « Mettre à jour ».

## Envoyer des modifs

« crée une PR », « ajoute ça à … », « mets ma PR à jour ».

1. Commit de tout ce qui a changé, sauf ce qui ressemble à un secret (`.env*`, `*.pem`, `*.key`, `credentials*`, `id_rsa*`, `.mcp.json`, mais pas `.env.example`, `.env.dist`, `.env.sample` qui se versionnent) et les dossiers générés non ignorés (`node_modules/`, `dist/`, `build/`, `.docusaurus/`). Message en anglais, conventional commits. Hook rouge → corriger, recommiter.
2. **Mettre à jour : `git merge origin/<base> --no-edit`, toujours.** Conflit :
   - code, config, fichier généré, lockfile (régénéré) : tu tranches en gardant l'intention des deux côtés, tu l'écris dans la PR ;
   - texte qu'elle sait lire (doc, `.md`, contenu métier) dont les deux versions se contredisent : « Quelle version garder ? », options « La tienne : … » et « Celle de l'équipe : … », phrases citées.
3. `git push -u origin HEAD`. Refusé → `git pull --no-rebase --no-edit origin <branche>`, résoudre, renvoyer.
4. PR existante : `gh pr ready` si brouillon, base corrigée si besoin, titre et description réécrits pour couvrir tout son contenu. Sinon `gh pr create --base <base> --title … --body-file …` sans `--draft`, titre court en français, corps = template du repo s'il existe, sinon `## Ce que change cette PR pour l'utilisateur`, `## Comment tester`, et `## Pour le relecteur` si tu as tranché ou corrigé quelque chose.
5. `gh pr checks --watch` (en arrière-plan si long). Rouge → `gh run view --log-failed`, corriger, commit, étape 3. Trois échecs → « Ta PR est en ligne mais un souci technique la bloque, un dev doit y jeter un œil : <lien> ».
6. `gh pr view --json mergeStateStatus,isDraft` : `BEHIND`/`DIRTY` → étape 2, brouillon → `gh pr ready`.

Message : « C'est fait : <lien>. Elle est prête, il reste la relecture d'un dev. »

## Appliquer les retours de relecture

« applique les retours », « corrige ce que demande X ».

1. Lire les reviews (`gh pr view <n> --json reviews,url`) et les fils non résolus :
   `gh api graphql -f query='{repository(owner:"<owner>",name:"<repo>"){pullRequest(number:<n>){reviewThreads(first:50){nodes{id isResolved path line comments(first:20){nodes{body author{login}}}}}}}}'`
2. Faire chaque changement demandé. Un retour qui laisse un choix métier ouvert → une question avec les options du relecteur. Un retour qui pose une question sans demander de changement → tu le cites dans le message final : « <relecteur> demande : « … ». Dis-moi quoi lui répondre. »
3. Un commit par retour, par-dessus (pas d'amend), puis « Envoyer » à partir de l'étape 2.
4. Résoudre chaque fil traité (`resolveReviewThread`), sans commentaire. Redemander la relecture : `gh pr edit <n> --add-reviewer <login>` pour chaque relecteur qui n'est pas la personne.

Message : « C'est corrigé : <lien>. <relecteur> va relire. »

## Où en est ma PR, je peux merger ?

1. Pas à jour ou checks rouges → « Envoyer » étapes 2, 3, 5 et 6 d'abord, sans demander. Titre et description d'une PR en relecture ne bougent pas ici.
2. `gh pr view <n> --json reviewDecision,latestReviews,url`, et les fils non résolus par la requête GraphQL de « Appliquer les retours ». Approuvée = `reviewDecision` à `APPROVED`. `reviewDecision` vide (aucune règle de protection) : une review `APPROVED` dans `latestReviews` et aucune `CHANGES_REQUESTED`. `REVIEW_REQUIRED` = pas approuvée.
3. Selon l'état :
   - changements demandés ou fils non résolus → « Pas encore : un dev a demandé des changements. Dis-moi « applique les retours » et je m'en occupe. »
   - pas approuvée → « Pas encore : elle attend la relecture d'un dev. <lien> »
   - approuvée → la méthode : `git log --merges origin/<base>..origin/<branche>` non vide, ou un commit qui en corrige un autre (« fix » d'un retour, d'une vérification, message hors conventional commits) → `Squash and merge`. Sinon `Create a merge commit`. Si `gh repo view --json squashMergeAllowed,mergeCommitAllowed` n'autorise pas cette méthode, prendre celle qui l'est.

Message (approuvée) : « Oui. Ouvre <lien>, clique sur la petite flèche à droite du bouton vert, choisis « Squash and merge », puis confirme. » (ou « Create a merge commit »)

## Changer de sujet

« je veux travailler sur … », « je passe à autre chose ».

1. Modifs pas envoyées sur la PR courante → « Tu as des modifs pas encore envoyées sur « <titre> ». J'en fais quoi ? », options « Les envoyer dans « <titre> » » et « Les mettre de côté pour plus tard ». Envoyer → section « Envoyer ».
2. Le sujet est une de ses PR ouvertes → s'y placer. Sinon → `git switch <base>`, `git merge --ff-only origin/<base>` : la nouvelle PR naîtra au premier « crée une PR ».

Message : « C'est prêt, tu peux commencer. »

## Ressortir des modifs mises de côté

`git stash list` filtré sur `gerer-une-pr:`. Se placer sur la PR nommée dans l'étiquette si elle est encore ouverte, sinon partir de `origin/<base>`. `git stash apply <sha>`, résoudre comme dans « Mettre à jour », supprimer l'entrée.

Message : « C'est ressorti, tu peux reprendre sur « <titre> ». »

## Tentations

| Tentation | Ce qu'on fait |
|---|---|
| « Pas de conflit, inutile de récupérer develop » | Le merge de « Mettre à jour » se fait toujours. |
| « Un rebase est en cours, je le termine » | `git rebase --abort`, puis merge. |
| « La PR est en brouillon, je demande » | `gh pr ready`, sans demander. |
| « Je lui explique le conflit tranché, l'arrondi, le contenu de la PR » | Description de la PR. Le message reste à deux lignes. |
| « Je lui propose de merger à sa place » | Jamais. Il clique, avec la méthode écrite noir sur blanc. |
| « Je lui dis de cliquer sur le bouton vert » | Le bouton garde la dernière méthode utilisée : toujours nommer la méthode. |
| « Je crée la nouvelle PR depuis là où il est » | Depuis `origin/<base>`, sinon elle embarque son autre PR. |
| « Je propose de jeter ses modifs » | Jamais. Envoyer ou mettre de côté. |
| « Je propose des tests, je vérifie la DoD, je cite les fichiers » | Rien de tout ça dans le message. |
| « C'est de la relecture ou de la CI, je passe au tech lead » | Tu fais toi-même : c'est ce skill qui s'applique. |
| « Je n'ai pas pu modifier le titre, je lui demande de le faire » | `gh pr edit` ; si l'outil est refusé, on laisse et on n'en parle pas. |
