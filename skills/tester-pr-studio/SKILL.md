---
name: tester-pr-studio
description: "Use when a tt-studio (theTribe Studio plugin) pull request must be tested end to end before merge: functional test of /studio:* commands on a throwaway Studio, \"tester la PR en mode craft\", replaying a PR test plan, checking a review fix for real, re-running a previous campaign on a new head, or reporting functional test results in the PR description, or deriving functional test scenarios from a Jira ticket's acceptance criteria."
---

# Tester une PR tt-studio en mode craft

Une PR de tt-studio change des prompts, des hooks et des scripts : seul un vrai Studio, avec le
plugin **de la branche**, dit si ça marche. Tu montes ce banc de test, une sous-session le joue, tu vérifies
contre des signaux objectifs. **Tu n'écris ni dans le plugin ni dans le repo pendant le test.**

Le skill se suffit : il tourne en terminal (avec ou sans Herdr) comme dans Claude Desktop, et
les règles de la sous-session sont dans `brief-sous-session.md`. Herdr ne sert que si le poste l'a (§3).

## 1. Le banc de test

| Pièce | Règle |
|---|---|
| Code testé | La branche de la PR **au head distant** : `git fetch origin <branche>`, puis `git rev-parse HEAD` du worktree = `gh pr view <N> --json headRefOid`. Worktree à toi sur cette branche : prends-le. Branche tenue par le worktree d'une **autre** session (verrouillé ou non) : **ne le réutilise pas**, son auteur peut y committer et le plugin, lié par symlinks, bougerait sous le test. Fais créer `! git -C <repo> worktree add -b test/pr<N> <repo>-pr<N> origin/<branche>`, `<repo>` étant le checkout principal (première ligne de `git worktree list`) : une session isolée ne peut pas le faire elle-même. Inscris-le dans la campagne pour le démontage. |
| Garde-fous | Dans ce worktree, avant toute sous-session : les suites shell touchées par le diff (liste dans `CLAUDE.md`, § Testing), puis `/craft:validate` et `/craft:lint`. Un rouge ici arrête la campagne : la sous-session ne teste pas un banc cassé. |
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
tel quel dans le brief de la sous-session.

**L'accord d'écriture** est distinct de la config : un fichier ne vaut pas le mot de l'utilisateur.
S'il n'a pas dit dans la conversation que tu peux écrire dans ce projet, **demande-le une fois, au
montage**, dans la même `AskUserQuestion` si la config manquait. Son accord ne couvre que ce
projet.

## 2. La campagne

Avant de briefer, écris `~/.claude/skills/tester-pr-studio/campagnes/pr-<N>.md` (chemin absolu
dans le brief) : head (SHA), namespace, worktree, Studios, fixtures (avec PID), projet Jira de test,
relevé Jira commun, scénarios, tableau des verdicts par SHA. `campagnes/` reste sur le poste : il
cite des tickets et des PR internes, il ne se publie pas avec le skill. Campagne déjà là : rejoue-la sur le nouveau head, ajoute les scénarios des
nouveaux commits, garde l'historique. Au même moment, purge les campagnes des autres PR fermées ou
mergées (`gh pr view <n> --json state` ≠ `OPEN`) : `pr-<n>.md` et ses `pr-<n>-*-rapport.md`. La
purge se fait au montage et non au démontage, parce qu'en fin de campagne la PR testée est encore
ouverte.

**Les scénarios** (Étant donné / Quand / Alors) viennent de ces sources, jamais d'une seule. **Le
ticket d'abord** : il dit ce qui a été promis, la PR seulement ce qui a été fait, et un test tiré de
la seule PR ne voit pas ce qu'elle a oublié.

0. **le ticket Jira** dont la clé est dans le titre, la branche ou le corps de la PR (`STD-NN`
   en général), lu en entier avec ses commentaires (`acli jira workitem view <CLÉ> --fields '*all'
   --json`, puis `comment list`). Lecture seule : ce ticket n'est pas dans le projet de test. Chaque
   critère d'acceptance donne **au moins un scénario**, et un critère que la PR ne couvre pas
   donne un scénario quand même, attendu KO. Numérote les critères dans la campagne (`CA1`,
   `CA2`…). Ticket sans critères explicites : tire-les de la description et des commentaires,
   numérote-les pareil, marqués **déduit** (`CA1 (déduit)`), parce que c'est ta lecture et non la
   promesse écrite. Pas de ticket : dis-le dans la campagne et pars de la PR ;
1. le test plan du corps de PR (`gh pr view <N> --json body`) ;
2. chaque commande, hook, script ou template touché (`gh pr diff <N> --name-only`) ;
3. chaque point de revue corrigé : commentaires de la PR **et** messages des commits de
   correction (`git log --grep '^fix' origin/main..`, corps compris : une revue faite hors GitHub
   n'existe que là) ;
4. un test manuel déjà joué (pane, Studio de test, rapport) : ses constats, et ce qu'il n'a pas
   couvert ou a couvert sur un head plus ancien.

Chaque scénario porte **sa source** (`CA2`, `test plan`, `diff`, `revue`, `test manuel`) : c'est ce
qui laisse voir qu'aucun critère n'a été sauté. Chaque scénario porte aussi **sa preuve** (fichier, ligne de registre ou de journal, ligne Pulsar, ticket
de test relu) et **son contrôle de polarité inverse**. « N'écrit rien dans Jira » se prouve par un relevé
du projet avant et après (statut, assignee, commentaires, `updated`), jamais par un brouillon.

**Une commande qui demande le feu vert du PM** : le scénario écrit la réponse du PM (oui, non,
correction), et la sous-session **ne se la donne jamais elle-même**. Elle s'arrête sur la question, tu
réponds ce que dit le scénario par le moyen de la sous-session (§3). Sinon l'invariant n'est pas testé.

**Hors de portée d'un Studio CLI**, chacun dans sa catégorie, jamais déclaré vérifié :
- *Desktop* : `mcp__scheduled-tasks__*`, carte « Toujours autoriser », `PushNotification`, rendu
  Desktop, store de plugins Desktop (séparé de celui du CLI). Pas à pas pour l'utilisateur.
- *Environnement* : ce qui suppose de couper acli, un MCP, le réseau dans la sous-session.
  « Déduit » de la lecture du source, scénario ouvert.

**Le volet Desktop se joue quand même, par une session Desktop que tu ouvres toi-même**, brief
dans ton scratchpad, rapport terminé par `FIN`. En mode auto, le classifieur refuse
`create_scheduled_task` sans recours : cette session tourne en mode « Demander ».
- Ta session a l'outil `mcp__ccd_session__start_session` : même lancement que la sous-session Desktop
  (§3), avec `permission_mode: "default"`. Ses invites de permission s'affichent chez elle :
  ouvre-la en split view pour l'utilisateur.
- Sinon (terminal) : `open "claude://code/new?folder=<Studio url-encodé>&q=<prompt url-encodé>"`.
  Elle apparaît dans `ListAgents` avec la mention « Claude Desktop session » ; tu lui envoies la
  suite par `SendMessage`. Elle ne te répond jamais : attends son `FIN` par une boucle `until` en
  arrière-plan. L'utilisateur la passe lui-même en mode « Demander ».

Cliquer « Toujours autoriser » au premier passage reste humain : dis-le d'avance. Une écriture Jira nécessaire à ce volet (le ticket qui déclenche
le passage), c'est toi qui la fais : la session Desktop n'écrit rien. Pas de Claude Desktop sur le
poste : ces scénarios restent « ⏸ Desktop », avec leur pas à pas.

## 3. La sous-session

Brief = `brief-sous-session.md` rempli, y compris `PARTICULARITES` (autre sous-session sur le projet de
test : isole-toi par le label dans le JQL de la commande testée), et les placeholders Jira tirés de
la config. Il tourne dans une session **neuve dont le cwd est le Studio**, lancée après le deploy.
Prends le premier moyen qui s'applique à ton poste :

| Moyen | Quand | Lancer, piloter, attendre |
|---|---|---|
| Pane Herdr | `HERDR_ENV=1` | Skill `herdr` : ouvre un pane dont le cwd est le Studio, lances-y `claude` avec le prompt « Lis <brief> et applique-le. », ferme-le en fin de campagne. Attendre : `SendMessage` sans message, `notify_when_idle: true`, sur son nom `ListAgents`. Feu vert du PM : `SendMessage` sur ce même nom. |
| Session Claude Desktop | Ta session a l'outil `mcp__ccd_session__start_session` (onglet Code de l'app) | `start_session` avec `initiation: "user_asked"` (l'invocation du skill vaut la demande), `context: "fresh"`, `cwd: <Studio>`, `use_worktree: false`, `name: <nom de la sous-session>`, `title: "test PR#<N> · <nom>"`, `prompt: "Lis <brief> et applique-le."`, `background` (80 caractères au moins : PR, head, rôle de sous-session), `permission_mode: "auto"`. Lance-la dans un tour ouvert par un message de l'utilisateur : un tour réveillé par une note de session voit son `start_session` refusé. Un Studio neuf peut afficher une carte « faire confiance au dossier » : préviens l'utilisateur. Relève l'id `local_…` du résultat, puis vérifie le cwd par `get_session`. **Attendre : rien.** Chaque fin de tour de la sous-session te réveille avec le début de son message final ; le reste se lit par `list_events`. Ni boucle `until`, ni `ScheduleWakeup`. Feu vert du PM : `SendMessage` avec `to` = l'id `local_…`, jamais le nom. Si les réveils cessent (longue suite sans message de l'utilisateur), `list_sessions {"linked": true}` donne l'état, et un mot de l'utilisateur les relance. Suivi par l'utilisateur : `mcp__ccd_window__open_session_in` (split view). `SendMessage` et les outils `ccd_*` sont différés : charge-les en un seul `ToolSearch`. |
| `claude -p` | Terminal sans Herdr | Une session headless par tour, `run_in_background`, `uuidgen` relevé une fois : `cd <Studio> && claude -p "Lis <brief> et applique-le." --session-id <uuid> --permission-mode auto --output-format stream-json --verbose > <scratchpad>/tour<i>.jsonl`. Le process sort à la fin de chaque tour, tu es notifié : pas de boucle d'attente. Feu vert du PM : relance `claude -p "<réponse du scénario>" --resume <uuid>` avec les mêmes options, depuis le même Studio. Le log est une preuve en soi : `jq 'select(.type=="system")'` donne le `cwd` et les plugins chargés, les `tool_result` portent les refus de hook mot pour mot, `select(.type=="result")` la fin du tour. Pas d'`AskUserQuestion` ni d'invite de permission dans cette session : l'accord Jira passe par toi avant le lancement. L'utilisateur peut suivre avec `tail -f` sur le log. |
| Sous-agent | Aucun des trois ne marche | Dernier recours, **banc dégradé** : il tourne dans ta session, avec ton cwd et les plugins chargés à ton démarrage. Ta session doit donc dater d'après le deploy, sinon relance-la. Les scénarios qui lisent le cwd de la session (project-guard, `pwd` d'un pré-check, racine du Studio prise au cwd, commande `/<plugin>:*` invoquée par `Skill`) sortent en **« non testable en sous-agent »**. Seuls les scripts appelés directement, avec la racine du Studio en argument ou en variable, restent prouvables. Feu vert du PM : il rend la main sur la question, tu le relances par `SendMessage` avec la réponse du scénario. L'accord Jira, demandé par toi, passe dans son brief. |

Le volet Desktop (§2) se joue toujours dans une session Desktop, quel que soit le moyen de la sous-session.

À la récolte, ne relaie rien que tu n'aies relu : le rapport, puis **au moins un signal par verdict
OK** (le fichier existe, la ligne est au registre, le ticket de test relu). Reporte les verdicts par SHA
dans la campagne.

## 4. Les pièges

- **`/studio:*` vise la production**, pas la branche, y compris dans un prompt de tâche programmée.
  Une commande de branche absente : le deploy a sauté, relance-le, n'improvise pas.
- **Nouvelle session obligatoire** après un deploy : la sous-session se lance après, jamais avant.
- **Plusieurs plugins de branche activés** injectent rules et hooks plusieurs fois : bruit de banc,
  pas un défaut de la PR. Ne désactive pas ceux des autres.
- **Un plugin de branche retiré casse toutes les sessions lancées avant son retrait** : elles
  gardent ses hooks, dont le script n'existe plus, et `python3` sort en code 2, ce qui refuse tout
  appel `Skill`. Symptôme : `can't open file …/pretooluse-studio-guard`. Remède : `/exit`, puis
  `herdr agent start <nom> --kind claude --pane <pane> -- --resume <uuid>`, qui garde la
  conversation et recharge les hooks (hors Herdr : `claude --resume <uuid>` depuis le même dossier ;
une session Desktop se rouvre). Ton propre `/craft:undeploy-local` fait la même chose aux
  autres sessions : dis à l'utilisateur lesquelles relancer.
- **Le classifieur du mode auto peut refuser un Skill** (« Unauthorized Persistence »). La sous-session
  qui suit alors les instructions à la main ne teste plus le chargement de la commande ni le hook
  `PreToolUse` : « non testable, refus du classifieur », scénario ouvert.
- **Un défaut trouvé se rend, il ne se corrige pas** dans le worktree de la PR. Pas même par toi
  pendant qu'une sous-session joue : le plugin est lié par symlinks à ce worktree, un correctif en
  cours de campagne change ce qu'il teste. Correctifs après la campagne, puis rejeu sur le
  nouveau head.
- **Un slash command tapé en prompt n'est pas un appel d'outil** : le project-guard (hook
  `PreToolUse`) ne le voit pas. Un scénario de garde se joue par l'invocation `Skill`, et la voie
  prompt se teste à part.

## 5. Rendre à l'utilisateur

Un bloc par PR : head testé, tableau scénario → verdict
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

   Critères de <CLÉ du ticket> : CA1 = <critère en une ligne> ; CA2 (déduit) = <…>.

   | Source | Scénario | Verdict | Preuve |
   |---|---|---|---|
   | <CA1 · CA1 (déduit) · test plan · diff · revue · test manuel> | <Étant donné / Quand, en une ligne> | ✅ OK · ❌ KO · ⏸ Desktop · ⚪ non testable | <ce qui a été relu> |

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

## 6. Démonter le banc de test

En fin de campagne, une fois le §5 rendu, dans cet ordre :

1. **Mets les preuves à l'abri** : copie le rapport de la sous-session dans
   `campagnes/pr-<N>-<SHA court>-rapport.md`.
2. **Ferme la sous-session** (pane : ferme-le par `herdr` ; session lancée par `start_session` :
   propose `archive_session` et n'archive que sur le oui de l'utilisateur, après
   `mcp__ccd_window__close_split` si tu l'as ouverte en split (l'app refuse d'archiver une session
   à l'écran) ; session ouverte par
   `open claude://` : dis à l'utilisateur de la fermer ; `claude -p` : rien à fermer, le process
   sort à chaque tour), et **arrête les fixtures** par leur PID
   relevé, rien d'autre. **Une tâche programmée créée par la campagne** se fait supprimer par la
   session Desktop (`delete_scheduled_task`), puis `list_scheduled_tasks` relu : une tâche
   oubliée continue de tourner toutes les quinze minutes sur un Studio qui va disparaître.
   L'outil laisse `~/.claude/scheduled-tasks/<taskId>/SKILL.md` sur disque, et ce reste bloque le
   même `taskId` à la campagne suivante : relis-le (le prompt doit être celui de la campagne), puis
   supprime-le avec son dossier.
3. **`/craft:undeploy-local` depuis le worktree de la campagne.** Avant, `ListAgents` (et
   `herdr agent list` sous Herdr, `list_sessions {"linked": true}` dans l'app) : une sous-session encore active sur le même plugin le perdrait. Dans ce cas, attends-la.
4. **Supprime ce que la campagne a inscrit, et cela seul** : pour chaque Studio de la liste,
   relève d'abord le `studio_id` de son `.claude/.studio-manifest.json`, puis supprime
   `/private/tmp/studio-test-<k>`, les fichiers d'état
   `find ~/.claude/plugins/data -path '*/studios/*' -name '<studio_id>.json'` (le hook SessionStart
   en pose un par plugin Studio activé, production comprise), et ses transcripts
   `~/.claude/projects/-private-tmp-studio-test-<k>` : laissés là, ils se mêlent à ceux de la
   prochaine campagne qui reprend le même `k`. Puis le worktree `test/pr<N>` s'il a été
   créé pour elle (`! git -C <repo> worktree remove …` puis
   `branch -D test/pr<N>`). Un `studio-test-*` ou un worktree absent de la liste appartient à
   quelqu'un d'autre : tu n'y touches pas.
5. Les tickets de test restent (label `test-pr-<N>`) : le projet est un bac à sable, et ils
   documentent la campagne.

Un Desktop restant à jouer par l'utilisateur ? Laisse le banc debout (plugin et Studio), dis-le, et
démonte quand il a fini.
