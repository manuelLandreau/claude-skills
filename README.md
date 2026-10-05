# claude-skills

Des skills [Claude Code](https://claude.com/claude-code) que j'utilise au quotidien. Elles sont
écrites en français.

## Les skills

### [`full-implem`](skills/full-implem/SKILL.md)

Mène un sujet jusqu'à la pull request en un seul prompt. Le sujet peut être une clé de ticket,
une PR à reprendre, une branche ou une simple description. La skill enchaîne plan,
implémentation et review.

Elle vise les deux dérives habituelles de cette chaîne : des reviews dont le nombre de findings
suit le niveau d'effort demandé plutôt que le code, et un scope qui déborde du ticket.

- **Plan gelé** : le plan approuvé est écrit sur disque et fait foi jusqu'à la fin. Ce qui n'y
  figure pas est hors scope.
- **Tranches contrôlées** : chaque tranche compare les fichiers qu'elle a touchés à ceux que le
  plan lui attribue, puis passe une `/code-review medium` sur son seul diff.
- **Deux relectures** : `/simplify` applique les corrections de qualité, puis une
  `/code-review high` sur la branche rapporte les problèmes de correctness. Les passes sur le
  diff des fix redescendent en `medium` pour que la boucle converge.
- **Livraison** : garde-fous CI (`ci-parity`), preuve runtime (`runtime-proof`), fixup fondus par
  autosquash, commits atomiques, PR en draft.

Une branche propre qui ressort zéro finding est un run réussi.

Usage : `/full-implem PROJ-123 garde le scope, front seulement`

### [`anneau-unique`](skills/anneau-unique/SKILL.md)

Sert à piloter plusieurs sessions Claude « ouvrières » depuis une session « anneau unique », dans
des onglets du multiplexeur Herdr. Un anneau pour les gouverner tous : il dispatche et supervise,
il ne code pas.

- **Le cycle d'un ouvrier** : ouvrir, briefer, surveiller, récolter, puis purger ou fermer.
- **Onglet ou sous-agent** : un onglet quand le travail devra s'arrêter pour demander (plan,
  arbitrage, PR), un sous-agent pour une mesure ou une lecture qui rend un verdict.
- **Les briefs** passent par un fichier, et les règles communes sont citées par leur chemin
  ([`regles-invariantes.md`](skills/anneau-unique/regles-invariantes.md)) au lieu d'être
  recopiées. Les exigences propres à un projet vont dans un `projets.local.md` à côté, jamais
  publié.
- **La surveillance** se fait par abonnement (`SendMessage` avec `notify_when_idle`), pas par
  sondage.
- **Les pièges déjà rencontrés** : un libellé d'onglet qui ment, un ouvrier « done » qui n'a pas
  commité, un statut périmé, un auto-rapport pris pour une preuve, un prompt resté tapé sans partir, un
  ouvrier bloqué sur une question.

Les ouvriers portent des noms du Seigneur des anneaux : les peuples d'abord (`elfes`, `nains`,
`humains`), puis d'autres peuples ou des personnages s'il en faut plus. Ces noms ne changent pas
quand le sujet change, contrairement à un nom tiré de la tâche.

La skill suppose `HERDR_ENV=1` et s'appuie sur la skill `herdr` pour la syntaxe du CLI.

### [`commits-and-prs`](skills/commits-and-prs/SKILL.md)

Le défaut pour committer, rebaser et ouvrir une PR quand le repo ne fixe pas ses propres règles
(une skill locale ou un `.github/pull_request_template.md` passe devant).

- **Commits atomiques** gardés propres par rebase local, quelle que soit la stratégie de merge
  du remote : amend ou fixup + autosquash non interactif, jamais de merge de la base.
- **Messages** en anglais, conventional commits, corps court qui dit le pourquoi.
- **Corps de PR** en deux sections : « En bref », laissée vide pour qu'un humain la rédige, et
  « Détails techniques », que l'agent peut remplir. Une édition repart du corps publié pour ne
  pas écraser ce que l'auteur y a mis.
- **Captures** rangées dans un dossier par PR, relues avant d'être annoncées.
- **Retours de review** : un commit correctif par-dessus, sans force-push.

### [`ci-parity`](skills/ci-parity/SKILL.md)

Rejoue en local les garde-fous CI qui décident du merge, lues dans les workflows du repo : filtres de
chemins scopés au diff, et les pièges où le local reste vert pendant que la CI passe au rouge
(lockfile périmé, deps de dev, garde-fous hors suite de tests, worktree sans stack).

### [`runtime-proof`](skills/runtime-proof/SKILL.md)

Prouve un changement en pilotant la vraie app locale, headless : ce qu'il faut savoir du projet
avant (URL, comptes, flags, reset), la séquence avant / action / rechargement / recoupement en
base, et les pièges (cache client sur `goto`, snapshot qui lit le DOM et pas la mise en page,
droits figés dans le token).

### [`dailysum`](skills/dailysum/SKILL.md)

Le daily prêt à coller dans Slack, une ligne par ticket : `✅ PROJ-123 - description courte :
Merged`. Le statut (WIP, CR, Merged) vient des PRs du repo courant, les reviews faites et les
commits sans ticket donnent quelques lignes en plus. Période par défaut : depuis le dernier jour
ouvré. Écrite pour macOS (`date -v`, `pbcopy`).

## Les rules

[`rules/`](rules) contient des règles courtes chargées par toutes les sessions, là où une skill
ne serait lue qu'à la demande : n'arrêter que ses propres process, pas de `git stash` nu entre
worktrees, pas d'écriture Jira sans accord direct, et la façon de rapporter une preuve.

## Installation

```bash
git clone https://github.com/manuelLandreau/claude-skills
cp -R claude-skills/skills/* ~/.claude/skills/
mkdir -p ~/.claude/rules && cp claude-skills/rules/* ~/.claude/rules/
```

Les skills et les rules sont alors disponibles dans toutes les sessions Claude Code.

Pour mettre la sauvegarde à jour depuis le poste, les versions locales étant déjà génériques :

```bash
for s in full-implem anneau-unique commits-and-prs ci-parity runtime-proof dailysum; do
  rsync -a --delete --exclude='*.local.md' --exclude='.DS_Store' ~/.claude/skills/$s/ skills/$s/
done
rsync -a --delete ~/.claude/rules/ rules/
```

## Hypothèses d'environnement

Ces skills ont été écrites pour mon poste. `full-implem` s'appuie sur `gh` ou `glab`, et au
besoin sur `acli` et `wtm`. Si un outil manque, elle le signale et s'adapte : elle n'installe
rien.

Les preuves runtime passent par un MCP Playwright headless et isolé, déclaré au niveau
utilisateur à la place du plugin `playwright`, qui le lance sans argument (fenêtre visible,
profil partagé qui bloque les sessions parallèles) :

```bash
claude mcp add -s user playwright -- npx -y @playwright/mcp@latest \
  --headless --isolated --output-dir ~/.cache/playwright-mcp/out
claude plugin disable playwright@claude-plugins-official
```
