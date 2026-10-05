---
name: ci-parity
description: Reproduce locally the CI checks that decide whether a change is mergeable, derived from the repo's own workflow files. Use before claiming a task is done, before proposing a pull request, or when a CI job went red and you need the same check locally. Covers reading the workflows, scoping to the diff through path filters, and the traps where local stays green while CI goes red (stale lockfile, dev-only deps, gates the test suite never runs, worktree stacks).
---

# CI parity

**Si le repo a sa propre skill de garde-fous CI, c'est elle qui fait foi** : elle porte les garde-fous maison. Cette skill est la méthode quand il n'y en a pas.

Le workflow CI est le contrat de merge. « Les tests passent » n'en est qu'une partie.

## 1. Lire le contrat

`.github/workflows/*.yml` (ou `.gitlab-ci.yml`). Pour chaque job, relever :

- **quand il tourne** : `on:` (push, pull_request, branches) et les filtres de chemins (`paths:`, action `paths-filter`). Un filtre couvre souvent plus que le dossier applicatif : le workflow lui-même, `.github/actions/**`, des scripts CI. Un diff qui ne touche que ceux-là lance quand même le job entier ;
- **ses étapes `run:`**, dans l'ordre, avec les `env:` et les flags exacts (settings de test, `--frozen-lockfile`, `--only main`…) ;
- les `needs:` : un job d'install dont tous les autres dépendent est un garde-fou à part entière.

Écarter ce qui n'est pas un garde-fou : déploiement, publication, upload d'artefacts, SBOM. Les signaler, ne pas les rejouer.

**Un script agrégé qui « mime la CI »** (`yarn pipeline:check`, `make ci`) : vérifier étape par étape qu'il couvre tout le workflow avant de s'y fier. Il omet souvent l'install figée ou une étape ajoutée depuis.

## 2. Scoper au diff

`git diff --name-only <base>...HEAD`, confronté aux filtres de chemins. Tourner tous les jobs déclenchés, pas seulement celui du dossier qu'on croit avoir touché.

## 3. Rejouer, dans l'environnement qui sert l'arbre validé

Mêmes commandes, mêmes flags, même ordre. Pièges où le local reste vert et la CI rouge :

- **Lockfile** : un conteneur ou un `node_modules` déjà installé ne voit pas un `package.json` édité sans lock à jour. Rejouer l'install figée (`yarn install --frozen-lockfile`, `npm ci`, `poetry install --sync`, `composer install` sur un lock propre).
- **Deps de prod** : si la CI installe sans les deps de dev (`--only main`, `--omit=dev`, `--no-dev`) avant certains garde-fous, un module de prod qui importe une dep de dev passe en local et casse là-bas.
- **Garde-fous hors suite de tests** : commandes de check maison, génération de schéma OpenAPI, compilation de tout l'arbre, build. Aucune n'est déclenchée par la suite de tests.
- **Fichiers générés** : un build qui régénère un fichier versionné (route tree, client API, types) → `git status` après le build ; un diff ici est un oubli de commit.
- **Worktree** : `docker compose exec` vise le projet compose du répertoire courant. Dans un worktree sans stack → `no such service` ; lancé depuis le checkout principal → il valide l'arbre principal et affiche vert pour du code jamais vérifié. Préfixer par `docker compose -p <project>` (`docker compose ls` donne le nom), ou passer par `wtm` si le repo l'utilise.
- **Version de runtime** : Node/Python/PHP de la CI (`setup-node`, image) contre celle du local. Une divergence se signale.

Le format ne se corrige pas à la main : lancer le formateur en mode écriture, puis le check.

## 4. Rapporter

Une ligne par garde-fou : commande → vert / rouge. **Un garde-fou rouge n’est pas un résultat, c’est du travail restant** : réparer, ou dire explicitement pourquoi il ne peut pas tourner en local. Les garde-fous sans équivalent local (label de release exigé, règle git sur un type de fichier) se listent comme règles à respecter.
