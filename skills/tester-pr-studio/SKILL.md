---
name: tester-pr-studio
description: "Use when a tt-studio (theTribe Studio plugin) pull request must be tested end to end before merge: functional test of /studio:* commands on a throwaway Studio, \"tester la PR en mode craft\", replaying a PR test plan, checking a review fix for real, re-running a previous campaign on a new head, or reporting functional test results in the PR description, or deriving functional test scenarios from a Jira ticket's acceptance criteria."
---

# Tester une PR tt-studio en mode craft

Une PR de tt-studio change des prompts, des hooks et des scripts : seul un vrai Studio, avec le
plugin **de la branche**, dit si ça marche. Tu montes ce banc, un camarade le joue, tu vérifies
contre des signaux objectifs. **Tu n'écris ni dans le plugin ni dans le repo pendant le test.**

Le camarade applique `regles-invariantes.md` de la skill `anneau-unique`, quel que soit l'endroit où
il tourne (§3). Skill absente du poste : arrête-toi et dis-le, elle s'installe depuis le même repo
que celui-ci.

## 1. Le banc

| Pièce | Règle |
|---|---|
| Code testé | La branche de la PR **au head distant** : `git fetch origin <branche>`, puis `git rev-parse HEAD` du worktree = `gh pr view <N> --json headRefOid`. Worktree à toi sur cette branche : prends-le. Branche tenue par le worktree d'une **autre** session (verrouillé ou non) : **ne le réutilise pas**, son auteur peut y committer et le plugin, lié par symlinks, bougerait sous le test. Fais créer `! git -C <repo> worktree add -b test/pr<N> <repo>-pr<N> origin/<branche>`, `<repo>` étant le checkout principal (première ligne de `git worktree list`) : une session isolée ne peut pas le faire elle-même. Inscris-le dans la campagne pour le démontage. |
| Garde-fous | Dans ce worktree, avant tout camarade : les suites shell touchées par le diff (liste dans `CLAUDE.md`, § Testing), puis `/craft:validate` et `/craft:lint`. Un rouge ici arrête la campagne : le camarade ne teste pas un banc cassé. |
| Plugin | `bash scripts/deploy-local.sh --verbose` **depuis ce worktree**. Le namespace est dans la sortie (`studio-<branche>-<hash>`, donc `studio-test-pr<N>-…` sur un worktree `test/pr<N>`). Vérifie avec `claude plugin list` que la source pointe sur **ce** worktree. |
| Studio de test | Dossier **neuf** `/private/tmp/studio-test-<k>`, `k` = premier entier libre. Écris `/private/tmp`, jamais `/tmp` : c'est un lien, et une commande qui compare son argument à `pwd` voit le chemin résolu. Jamais un dossier existant : il appartient peut-être à une autre campagne. macOS purge `/private/tmp` au redémarrage : une campagne qui doit y survivre le dit à l'utilisateur. Inscris-le dans la campagne. |
| Jira | Le **projet de test** de la config utilisateur (ci-dessous), modelable à volonté, et lui seul. Au montage, relève par acli ses types et ses statuts, et reporte-les dans la campagne : un statut ou une colonne qui manque est un geste d'admin de workflow, il se demande. Résumé préfixé `[test PR#<N>]`, label `test-pr-<N>`. |
| Fixtures | Une commande qui exige un produit (environnement, dépôt de PR, version déployée) reçoit une **fixture neutre** : dépôt git local et serveur statique dans le scratchpad, PID relevé. Une fixture d'une campagne précédente se copie, elle ne se partage pas. Jamais un vrai dépôt client ni `thetribeio/tt-studio`. |

**Le Jira de test** se lit dans `~/.config/tester-pr-studio/config.json` :

```json
{
  "jira_site": "<org>.atlassian.net",
  "jira_projet": "<CLÉ>",
  "notes": "<ce que le projet a de particulier : statuts, MCP refusé, board…>"
}
```

Fichier absent ou incomplet : **demande le site et la clé à l'utilisateur** par `AskUserQuestion`,
écris le fichier, et relis-le. Jamais un projet deviné, ni celui du ticket de la PR. `notes` passe
tel quel dans le brief du camarade.

**L'accord d'écriture** est distinct de la config : un fichier ne vaut pas le mot de l'utilisateur.
S'il n'a pas dit dans la conversation que tu peux écrire dans ce projet, **demande-le une fois, au
montage**, dans la même `AskUserQuestion` si la config manquait. Son accord ne couvre que ce
projet.

## 2. La campagne

Avant de briefer, écris `~/.claude/skills/tester-pr-studio/campagnes/pr-<N>.md` (chemin absolu
dans le brief) : head (SHA), namespace, worktree, Studios, fixtures (avec PID), projet Jira de test,
relevé Jira commun, scénarios, tableau des verdicts par SHA. `campagnes/` reste sur le poste : il
cite des tickets et des PR internes, il ne se publie pas avec le skill. Campagne déjà là : rejoue-la sur le nouveau head, ajoute les scénarios des
nouveaux commits, garde l'historique.

**Les scénarios** (Étant donné / Quand / Alors) viennent de ces sources, jamais d'une seule. **Le
ticket d'abord** : il dit ce qui a été promis, la PR seulement ce qui a été fait, et un test tiré de
la seule PR ne voit pas ce qu'elle a oublié.

0. **le ticket Jira** dont la clé est dans le titre, la branche ou le corps de la PR (`STD-NN`
   en général), lu en entier avec ses commentaires (`acli jira workitem view <CLÉ> --fields '*all'
   --json`, puis `comment list`). Lecture seule : ce ticket n'est pas dans le projet de test. Chaque
   critère d'acceptance donne **au moins un scénario**, et un critère que la PR ne couvre pas
   donne un scénario quand même, attendu KO. Pas de ticket : dis-le dans la campagne et pars de
   la PR ;
1. le test plan du corps de PR (`gh pr view <N> --json body`) ;
2. chaque commande, hook, script ou template touché (`gh pr diff <N> --name-only`) ;
3. chaque point de revue corrigé : commentaires de la PR **et** messages des commits de
   correction (`git log --grep '^fix' origin/main..`, corps compris : une revue faite hors GitHub
   n'existe que là) ;
4. un test manuel déjà joué (pane, Studio de test, rapport) : ses constats, et ce qu'il n'a pas
   couvert ou a couvert sur un head plus ancien.

Chaque scénario porte **sa preuve** (fichier, ligne de registre ou de journal, ligne Pulsar, ticket
de test relu) et **son contrôle de polarité inverse**. « N'écrit rien dans Jira » se prouve par un relevé
du projet avant et après (statut, assignee, commentaires, `updated`), jamais par un brouillon.

**Une commande qui demande le feu vert du PM** : le scénario écrit la réponse du PM (oui, non,
correction), et le camarade **ne se la donne jamais lui-même**. Il s'arrête sur la question, tu
réponds ce que dit le scénario par le moyen du camarade (§3 : `herdr agent prompt` ou `SendMessage`). Sinon l'invariant n'est pas testé.

**Hors de portée d'un Studio CLI**, chacun dans sa catégorie, jamais déclaré vérifié :
- *Desktop* : `mcp__scheduled-tasks__*`, carte « Toujours autoriser », `PushNotification`, rendu
  Desktop, store de plugins Desktop (séparé de celui du CLI). Pas à pas pour l'utilisateur.
- *Environnement* : ce qui suppose de couper acli, un MCP, le réseau dans la session du camarade.
  « Déduit » de la lecture du source, scénario ouvert.

**Le volet Desktop se joue quand même, par une session Desktop que tu ouvres toi-même** :
`open "claude://code/new?folder=<Studio url-encodé>&q=<prompt url-encodé>"`, le prompt pointant un
brief dans ton scratchpad. Elle apparaît dans `ListAgents` avec la mention « Claude Desktop
session » ; tu lui envoies la suite par `SendMessage`. Elle ne te répond jamais : son brief lui
fait écrire un rapport terminé par `FIN`, que tu attends par une boucle `until` en arrière-plan.
Deux gestes restent humains, dis-les d'avance : passer cette session en mode « Demander » (en mode
auto, le classifieur refuse `create_scheduled_task` sans recours), et cliquer « Toujours
autoriser » au premier passage. Une écriture Jira nécessaire à ce volet (le ticket qui déclenche
le passage), c'est toi qui la fais : la session Desktop n'écrit rien.

## 3. Le camarade

Brief = `brief-camarade.md` rempli, y compris `PARTICULARITES` (autre camarade sur le projet de
test : isole-toi par le label dans le JQL de la commande testée), et les placeholders Jira tirés de
la config. Il tourne dans une session **neuve dont le cwd est le Studio**, lancée après le deploy.
Prends le premier moyen disponible :

| Moyen | Quand | Lancer, piloter, attendre |
|---|---|---|
| Pane Herdr | `HERDR_ENV=1` | **REQUIRED SUB-SKILL :** `anneau-unique` (pane empilé, brief, abonnement au nom `ListAgents`, fermeture) et `herdr` pour la syntaxe. |
| Session Claude Desktop | Desktop installé, pas de Herdr | `open "claude://code/new?folder=<Studio url-encodé>&q=<prompt url-encodé>"`, le prompt pointant le brief. Suite et feux verts du PM par `SendMessage` (la session porte la mention « Claude Desktop session » dans `ListAgents`). Elle ne te répond jamais : attends son statut ou son rapport terminé par `FIN` par une boucle `until` en arrière-plan. L'utilisateur voit la fenêtre : il y répond lui-même aux questions d'accord. |
| Sous-agent | Ni Herdr ni Desktop | Dernier recours, **banc dégradé** : il tourne dans ta session, avec ton cwd et les plugins chargés à ton démarrage. Ta session doit donc dater d'après le deploy, sinon relance-la. Les scénarios qui lisent le cwd de la session (project-guard, `pwd` d'un pré-check, racine du Studio prise au cwd, commande `/<plugin>:*` invoquée par `Skill`) sortent en **« non testable en sous-agent »**. Seuls les scripts appelés directement, avec la racine du Studio en argument ou en variable, restent prouvables. Feu vert du PM : il rend la main sur la question, tu le relances par `SendMessage` avec la réponse du scénario. L'accord Jira, demandé par toi, passe dans son brief. |

Le volet Desktop (§2) se joue toujours dans une session Desktop, quel que soit le moyen du camarade.

À la récolte, ne relaie rien que tu n'aies relu : le rapport, puis **au moins un signal par verdict
OK** (le fichier existe, la ligne est au registre, le ticket de test relu). Reporte les verdicts par SHA
dans la campagne.

## 4. Les pièges

- **`/studio:*` vise la production**, pas la branche, y compris dans un prompt de tâche programmée.
  Une commande de branche absente : le deploy a sauté, relance-le, n'improvise pas.
- **Nouvelle session obligatoire** après un deploy : le camarade se lance après, jamais avant.
- **Plusieurs plugins de branche activés** injectent rules et hooks plusieurs fois : bruit de banc,
  pas un défaut de la PR. Ne désactive pas ceux des autres.
- **Un plugin de branche retiré casse toutes les sessions lancées avant son retrait** : elles
  gardent ses hooks, dont le script n'existe plus, et `python3` sort en code 2, ce qui refuse tout
  appel `Skill`. Symptôme : `can't open file …/pretooluse-studio-guard`. Remède : `/exit`, puis
  `herdr agent start <nom> --kind claude --pane <pane> -- --resume <uuid>`, qui garde la
  conversation et recharge les hooks (hors Herdr : `claude --resume <uuid>` depuis le même dossier ;
une session Desktop se rouvre). Ton propre `/craft:undeploy-local` fait la même chose aux
  autres sessions : dis à l'utilisateur lesquelles relancer.
- **Le classifieur du mode auto peut refuser un Skill** (« Unauthorized Persistence »). Le camarade
  qui suit alors les instructions à la main ne teste plus le chargement de la commande ni le hook
  `PreToolUse` : « non testable, refus du classifieur », scénario ouvert.
- **Un défaut trouvé se rend, il ne se corrige pas** dans le worktree de la PR. Pas même par toi
  pendant qu'un camarade joue : le plugin est lié par symlinks à ce worktree, un correctif en
  cours de campagne change ce qu'il teste. Correctifs après la campagne, puis rejeu sur le
  nouveau head.
- **Un slash command tapé en prompt n'est pas un appel d'outil** : le project-guard (hook
  `PreToolUse`) ne le voit pas. Un scénario de garde se joue par l'invocation `Skill`, et la voie
  prompt se teste à part.

## 5. Rendre à l'utilisateur

Un bloc par PR (pastille et étiquette de l'anneau unique) : head testé, tableau scénario → verdict
(OK / KO / Desktop / non testable) avec le verbe mesuré ou déduit, chaque KO avec fichier:ligne,
tickets de test créés, ce qui reste à faire sur Desktop.

Puis **enrichis le corps de la PR**, ce que l'invocation du skill autorise quand l'utilisateur est
l'auteur de la PR (`gh pr view <N> --json author`). PR d'un autre auteur : demande d'abord.

1. **Repars du corps publié** (`gh pr view <N> --json body`), jamais d'un gabarit : GitHub remplace
   le champ entier, et tout ce que l'auteur y a écrit se recopie verbatim.
2. **Coche la liste de vérifications existante** (en général `## Vérifications`) : `[ ]` → `[x]`
   seulement quand **tous** les scénarios de la ligne sont OK et mesurés, suivi de
   `(craft, <SHA court>)`. Ligne KO : reste `[ ]`, suivie de `KO, cf. Tests fonctionnels`. Ligne
   Desktop : reste `[ ]`, suivie de `à jouer sur Desktop`.
3. **Écris ou remplace la section `## Tests fonctionnels (craft)`**, à la fin, du titre jusqu'au
   `## ` suivant :

   ```markdown
   ## Tests fonctionnels (craft)

   Head `<SHA court>` · plugin de branche `<namespace>` · Studio jetable · Jira de test <CLÉ> · <date>

   | Scénario | Verdict | Preuve |
   |---|---|---|
   | <Étant donné / Quand, en une ligne> | ✅ OK · ❌ KO · ⏸ Desktop · ⚪ non testable | <ce qui a été relu> |

   **KO** : <fichier:ligne, attendu vs observé>, un par ligne.
   **Reste à jouer sur Desktop** : <pas à pas>.
   Tickets de test : <clés>. Campagnes précédentes : <SHA court> → <n OK / n KO>.
   ```

   La colonne Preuve dit ce qui a été relu (sortie JSON, ligne de registre, ticket de test relu avant
   et après), sans chemin local : le Studio de test aura disparu, et un relecteur ne lit pas ton
   disque.

4. `gh pr edit <N> --body-file <fichier>`, puis **relis le corps publié** : la section est là, les
   cases cochées sont celles prévues, rien de l'auteur n'a bougé. Aucune ligne d'attribution Claude.

Commentaire sur la PR, review ou annonce : seulement si l'utilisateur le demande.

## 6. Démonter le banc

En fin de campagne, une fois le §5 rendu, dans cet ordre :

1. **Mets les preuves à l'abri** : copie le rapport du camarade dans
   `campagnes/pr-<N>-<SHA court>-rapport.md`.
2. **Ferme le camarade** (pane : §7 de l'anneau unique ; session Desktop : dis à l'utilisateur de
   la fermer), et **arrête les fixtures** par leur PID
   relevé, rien d'autre. **Une tâche programmée créée par la campagne** se fait supprimer par la
   session Desktop (`delete_scheduled_task`), puis `list_scheduled_tasks` relu : une tâche
   oubliée continue de tourner toutes les quinze minutes sur un Studio qui va disparaître.
   L'outil laisse `~/.claude/scheduled-tasks/<taskId>/SKILL.md` sur disque, et ce reste bloque le
   même `taskId` à la campagne suivante : relis-le (le prompt doit être celui de la campagne), puis
   supprime-le avec son dossier.
3. **`/craft:undeploy-local` depuis le worktree de la campagne.** Avant, `ListAgents` (et
   `herdr agent list` sous Herdr) : un camarade encore actif sur le même plugin le perdrait. Dans ce cas, attends-le.
4. **Supprime ce que la campagne a inscrit, et cela seul** : chaque
   `rm -rf /private/tmp/studio-test-<k>` de la liste, et le worktree `test/pr<N>` s'il a été
   créé pour elle (`! git -C <repo> worktree remove …` puis
   `branch -D test/pr<N>`). Un `studio-test-*` ou un worktree absent de la liste appartient à
   quelqu'un d'autre : tu n'y touches pas.
5. Les tickets de test restent (label `test-pr-<N>`) : le projet est un bac à sable, et ils
   documentent la campagne.

Un Desktop restant à jouer par l'utilisateur ? Laisse le banc debout (plugin et Studio), dis-le, et
démonte quand il a fini.
