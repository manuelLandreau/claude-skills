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
  plan lui attribue.
- **Deux relectures** : `/simplify` applique les corrections de qualité, puis
  `/code-review medium` rapporte les problèmes de correctness.
- **Livraison** : gates CI, preuve runtime avec Playwright, commits atomiques, PR en draft.

Une branche propre qui ressort zéro finding est un run réussi.

Usage : `/full-implem PROJ-123 garde le scope, front seulement`

### [`anneau-unique`](skills/anneau-unique/SKILL.md)

Sert à piloter plusieurs sessions Claude « ouvrières » depuis une session maître, dans des
onglets du multiplexeur Herdr. Le maître dispatche et supervise, il ne code
pas.

- **Le cycle d'un ouvrier** : ouvrir, briefer, surveiller, récolter, puis purger ou fermer.
- **Les briefs** passent par un fichier, et les règles communes sont citées par leur chemin
  ([`regles-invariantes.md`](skills/anneau-unique/regles-invariantes.md)) au lieu d'être
  recopiées.
- **La surveillance** se fait par abonnement (`SendMessage` avec `notify_when_idle`), pas par
  sondage.
- **Les pièges déjà rencontrés** : un libellé d'onglet qui ment, un ouvrier « done » qui n'a pas
  commité, un statut périmé, un auto-rapport pris pour une preuve.

Les ouvriers portent des noms du Seigneur des anneaux. Ces noms ne changent pas quand le sujet
change, contrairement à un nom tiré de la tâche.

La skill suppose `HERDR_ENV=1` et s'appuie sur la skill `herdr` pour la syntaxe du CLI.

## Installation

```bash
git clone https://github.com/manuelLandreau/claude-skills
cp -R claude-skills/skills/* ~/.claude/skills/
```

Les skills sont alors disponibles dans toutes les sessions Claude Code.

## Hypothèses d'environnement

Ces skills ont été écrites pour mon poste. `full-implem` s'appuie sur `gh` ou `glab`, et au
besoin sur `acli` et `wtm`. Elle utilise aussi un Chromium local pour les preuves runtime. Si un
outil manque, elle le signale et s'adapte : elle n'installe rien.
