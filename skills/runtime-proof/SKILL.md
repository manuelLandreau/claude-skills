---
name: runtime-proof
description: Use when proving a change works by driving the real local app with Playwright (or through its API, DB and logs) — before a PR, when capturing before/after screenshots, or when a ticket must be checked at runtime. Covers what to learn about the project first (URLs, personas, accounts, flags, reset), the proof sequence, and the traps (client cache on goto, snapshots that read the DOM not the layout, MCP screenshot paths, headless by default, rights cached in tokens).
---

# Preuve runtime

Prouver, c'est piloter la vraie surface en local, pas constater que les tests passent. **Si le repo a une skill de pilotage navigateur (`testing-locally-with-*` ou équivalent), la suivre** : elle porte les URL, les comptes et les pièges du projet. Cette skill en est le socle.

## 1. Ce qu'il faut savoir du projet avant de lancer le navigateur

Chercher dans la skill du repo, puis CLAUDE.md, README, seeds, `docker-compose`, `.env.example` :

| Besoin | Où le trouver en général |
|---|---|
| URL du front, de l'API, de chaque app | compose, `.env*`, config Vite/Next |
| Routing particulier (sous-domaine, slug en préfixe de route) | routeur du front |
| Page de login par persona (admin, utilisateur final…) | routeur, guards |
| Comptes seedés et comment obtenir un mot de passe | scripts de seed, fixtures |
| Accès conditionnel : feature flags, modules, rôles | modèle/table des flags, guards |
| Remettre un état connu | commande de seed/reset, dump |
| Logs de l'API | `docker compose logs <service> --since 3m` |

Ce qui a demandé plus de deux tours à trouver → le proposer à l'utilisateur pour une skill `testing-locally-with-playwright` **du repo**. Ne pas l'écrire dans cette skill globale : elle ne porte aucune donnée d'un projet client.

Pas de skill de pilotage dans le repo ni de serveur MCP Playwright propre au projet : utilise le MCP utilisateur `playwright` (outils `mcp__playwright__*`). Il tourne headless et `--isolated`, profil en mémoire, donc plusieurs sessions en parallèle ne se bloquent pas sur un profil partagé. Absent de la session : script Node avec le Playwright du projet, les navigateurs téléchargés sont dans `~/Library/Caches/ms-playwright` (pas `~/.cache`). N'installe pas de navigateur.

## 2. Préflight, avant le premier parcours

Une passe, avant toute capture : bloquer en une minute plutôt qu'au troisième scénario.

- **Stack debout** : conteneurs du projet up, base qui répond (`pg_isready` ou équivalent).
- **Code servi = arbre validé** : API et front démarrés depuis ce worktree, après son dernier commit ou en watch. Pas un process, une image ou un `dist/` d'une autre branche ou du checkout principal.
- **Schéma à jour** : un client généré (Prisma, proxies Doctrine, client OpenAPI…) plus vieux que son schéma se régénère sans demander, c'est un artefact local. Les migrations de la branche s'appliquent sur la base du worktree (`wtm`) ; sur une base partagée avec d'autres checkouts, elles se demandent.
- **Comptes** : chaque persona a un login utilisable sans l'utilisateur. Un SSO (Keycloak…) ou un staging qui exige un identifiant que tu n'as pas se demande **maintenant**, en une question, pas après le montage.

Un point rouge que tu ne peux pas lever → **bloqué**, le dire avec la commande qui le lève. Ne jamais se rabattre sur un autre environnement.

## 3. Séquence de preuve

1. Poser un état de départ connu en base, et le vérifier.
2. `page.reload()`, capture « avant ».
3. Agir dans l'écran, comme l'utilisateur (clics, saisie, navigation).
4. `page.reload()`, capture « après ». Le rechargement distingue un état persisté d'un état local.
5. Recouper en base, et dans les logs, que la requête attendue est passée.
6. Remettre la donnée de dev dans son état initial.

Une capture n'est pas une preuve, le parcours l'est. Souvent plus fort qu'une capture : une assertion sur les appels réseau réellement partis (`browser_network_requests`, ou `page.on("response", …)` en script), qui prouve par exemple qu'une section verrouillée ne déclenche aucune requête plutôt qu'un 403. Un critère = un parcours ; les parcours indépendants tournent tous, un échec n'annule pas les autres. Ce qui n'a pas de surface UI (API, e-mail, tâche asynchrone, ligne en base) se prouve par `curl`, requête SQL ou log, et se rapporte comme preuve hors navigateur.

## 4. Pièges vérifiés

**Cache client sur `page.goto`.** TanStack Query, SWR, Apollo servent les données en cache après une écriture directe en base : un `goto` peut réafficher l'ancien état. `page.reload()` récupère l'état serveur.

**Un snapshot d'accessibilité lit le DOM, pas la mise en page.** Débordement, texte cassé mot à mot, éléments superposés, panneau qui recouvre l'écran : tout passe le snapshot. **Relire chaque capture (`Read`) avant de l'annoncer.**

**Les captures du MCP Playwright ne vont pas où on les demande.** Un nom relatif s'écrit dans le cwd, donc à la racine du repo ; un chemin absolu hors de `~/.cache/playwright-mcp/out` (son `--output-dir`) est refusé. Donne un chemin absolu sous ce dossier, dans un sous-dossier par PR — `~/.cache/playwright-mcp/out/<branche sans préfixe feat/|fix/>/<clé>-<id>-avant.png` — et laisse-la là : jamais de copie sur le Bureau, la capture finit dans le corps de la PR (skill `commits-and-prs`). Vérifie que `git status` ne montre aucun PNG.

**Headless par défaut.** Une fenêtre visible vole le focus de l'utilisateur, et il peut y toucher. Si on te demande un navigateur visible, une donnée qui change sans action de ta part n'est pas forcément un bug : demander avant de conclure, puis rejouer depuis un état remis à plat pour que la preuve soit attribuable.

**Droits portés par le token.** Rôles et permissions souvent figés dans le JWT ou mis en cache pour sa durée : après un changement de droit, se déconnecter et se reconnecter, sinon l'écran reste masqué sans erreur.

**Écran masqué ou 403 sans raison apparente** : chercher un accès conditionnel cumulatif (flag global + activation par organisation/tenant + rôle) avant de conclure à un bug.

## Jamais

- Piloter autre chose que le local. L'accès à un cluster ou à la prod se demande, même en lecture seule.
- Modifier le code pendant la passe de preuve, sauf si l'utilisateur a aussi demandé de corriger.
- Laisser une capture dans l'arbre de travail.
