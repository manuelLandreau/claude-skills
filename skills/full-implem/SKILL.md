---
name: full-implem
description: >
  Use when carrying a subject all the way from its statement to a draft pull request in one
  prompt: a ticket key (PROJ-1058), a PR/MR number or URL to pick up, a branch, or just a
  described change. Also when reviews keep producing findings or the scope keeps drifting past
  the ticket.
argument-hint: <clé de ticket | PR | branche | contexte libre, tout optionnel et auto-détecté>
---

Communique en français, dense, sans énumérer les micro-étapes. Commandes, chemins et
identifiants techniques inchangés.

## Le principe

Un prompt, une PR relisable. Cette skill automatise `plan -> implémentation -> review` pour que
l'utilisateur n'ait plus à le redicter à chaque ticket, et surtout pour qu'il ne le redicte plus
mal : les deux pathologies de cette chaîne sont des findings qui n'en finissent pas et un scope
qui déborde, et elles ont la même cause, rien n'est gelé.

Ici le plan approuvé est gelé sur disque et **fait autorité jusqu'à la fin du run**. Toute
question de périmètre, à n'importe quelle phase, se tranche en relisant ce fichier, jamais en
relisant la conversation. Tout ce qui n'y est pas est hors scope, même si c'est une bonne idée,
même si la review a raison.

### Les deux relectures, et quel niveau où

`/simplify` **applique** : 4 agents parallèles sur reuse, simplification, efficiency, altitude,
aucune chasse aux bugs. On ne lit pas sa sortie, on relit son diff.

`/code-review` **rapporte** de la correctness, et c'est le seul moment où l'utilisateur arbitre
quelque chose. Son niveau dépend de ce qu'il relit :

| Passe | Niveau | Pourquoi |
|---|---|---|
| Tranche (phase 2) | `medium` | petit diff, seuil de redécoupage calé sur ce niveau |
| Première passe finale (phase 6) | `high` | la seule où une couverture plus large paie ; le tri `CONFIRMED` + plan absorbe le bruit |
| Diff des fix (phase 6) | `medium` | en `high`, la boucle « rien de nouveau » ne converge pas |

`xhigh` et `max` ne sont jamais la réponse : leur pipeline sur-signale sans vérifier, donc la
taille de la liste suit la molette et pas le code. `/review` ne convient pas non plus, il cible
une PR qui n'existe pas encore ici.

Le niveau est collant : sans niveau écrit, `/code-review` reprend le dernier tapé. **Écris-le à
chaque appel**, sinon la passe de fix après la finale repart en `high`.

## L'argument unique

Tout ce qui suit `/full-implem` est un seul texte libre. Détecte dedans, dans cet ordre :

| Motif trouvé | Interprétation |
|---|---|
| `[A-Z][A-Z0-9]+-[0-9]+`, y compris dans une URL Jira | clé de ticket, **mode ticket** |
| URL `…/pull/<n>` ou `…/merge_requests/<n>` | **mode reprise** sur cette PR/MR |
| entier nu de 1 à 6 chiffres, en tête du texte | numéro de PR/MR sur la forge du repo, **mode reprise** |
| un nom de branche qui existe en local ou sur `origin/` | **mode reprise** sur cette branche |
| tout le reste | **contexte**, contraignant, à respecter à la lettre |

Plusieurs clés de ticket : la première est la cible, les autres du contexte. Rien de
détectable : déduis la cible de la branche courante (elle porte souvent la clé) et du diff vs
la base ; si tu es sur la branche par défaut avec un diff vide, demande, sinon avance.

En cas de contradiction, **le contexte libre écrase le ticket**. C'est lui qui porte l'intention
du moment.

Ne fais jamais confirmer une détection évidente. Annonce-la en une ligne et enchaîne.

```
/full-implem PROJ-1058
/full-implem PROJ-1058 garde le scope, pas de refacto du modal, KISS
/full-implem 1431 finis juste la review et la PR
/full-implem https://github.com/<org>/<repo>/pull/1431
/full-implem le bouton export ne rend rien sur Safari       (ni ticket ni PR : c'est valide)
/full-implem ABC-650 en worktree, front seulement
```

**Mode reprise** : le code existe déjà. Reconstruis le plan gelé (phase 1) depuis le ticket, le
corps de la PR et le diff, fais-le approuver, puis saute la phase 2 s'il ne reste rien à écrire.

## Phase 0. Reconnaissance

Une passe, silencieuse, en parallèle. N'installe jamais rien : si un outil manque, dis-le et
adapte-toi.

- **Forge** : `gh` si le remote est GitHub, `glab` si GitLab. Aucune des deux, pas de PR : tu
  t'arrêtes après les commits et tu l'annonces maintenant, pas à la fin.
- **Tracker** : `acli jira` s'il est installé et authentifié, sinon le MCP Atlassian, sinon la
  clé de ticket n'est qu'une étiquette et le plan se construit sur le seul contexte libre.
- **Skills du repo** dans `.claude/skills/` : repère celles qui couvrent les gates CI, les
  conventions de commit et de PR, le pilotage du navigateur, la relecture par stack. Les noms
  varient d'un projet à l'autre (`ci-checks`, `pr-and-commits`, `testing-locally-with-*`,
  `*-code-reviewer`), lis les `description:` plutôt que de chercher un nom exact.
  **Utilise-les, ne les réimplémente pas** : elles portent les comptes seedés, les gates maison
  et les conventions de PR que tu ignores.
- **Commandes de test et de lint** : CLAUDE.md, puis README, puis `package.json` / `Makefile` /
  `composer.json` / `pyproject.toml`.

### Worktree

Crée un worktree seulement si l'une de ces conditions tient : l'arbre courant est sale sur une
branche autre que la cible ; le contexte libre le demande (« worktree », « isolé », « en
parallèle ») ; il te faut le runtime alors qu'une autre session occupe déjà la stack du repo.

Sinon reste dans le checkout courant, un worktree coûte une stack complète. Si tu en crées un,
**invoque la skill `wtm` et suis-la**, ne pilote pas `wtm` de mémoire. Repo absent du registre
wtm : ne l'y ajoute pas toi-même, dis-le et reste sur place.

## Phase 1. Plan, puis gel

C'est le `plan` de la chaîne, et le seul point d'arrêt du run.

Entre en **mode plan** (`EnterPlanMode`). Construis le plan depuis le ticket, le contexte libre
et le code. Il doit contenir, dans cet ordre et sans exception :

1. **Objectif**, une phrase.
2. **Dans le scope**, 3 à 6 puces.
3. **Hors scope**, 3 à 6 puces, nommées explicitement. C'est la section qui fera taire la review
   en phase 6 ; un plan sans elle n'est pas approuvable.
4. **Tranches**, une ligne chacune, avec pour chacune **la liste des fichiers ou dossiers
   qu'elle touchera**. Cette liste est le garde-fou mécanique du scope, pas une estimation.
5. **DoD**, comment on prouve que c'est fait.
6. **Preuve runtime**, quel écran, quel parcours.

Sors du mode plan (`ExitPlanMode`) pour le faire approuver. **Son approbation vaut contrat.**

Dès l'approbation, écris-le tel quel dans `.full-implem/<cible>.md` (dans le scratchpad de
session si le repo ne doit rien accueillir), avec une section `Reporté` vide en fin de fichier.
Ce fichier est désormais la référence. Relis-le au début de chaque phase suivante ; ne te fie
pas à ton souvenir du plan, c'est exactement là que le scope part.

## Phase 2. Implémentation par tranches

Une tranche = une entrée du plan. Ni plus, ni moins.

Pour chaque tranche :

1. Coder, puis tests de la tranche au vert.
2. **Contrôle de scope, avant toute review.** Compare `git diff --name-only` de la tranche à la
   liste de fichiers que le plan lui donne. Tout fichier hors liste part dans un des deux
   paniers, jamais dans le commit sans décision : soit il est mécaniquement imposé par la
   tranche (import, type généré, migration) et tu le gardes en le disant en une ligne, soit tu
   le **révoques** (`git checkout --`) et la ligne va sous `Reporté`. Aucun « tant qu'on y est »,
   aucun renommage d'opportunité, aucune abstraction absente du plan.
3. `/code-review medium` **sur le diff de cette tranche uniquement**, jamais sur la branche.
4. Corriger ce qui est `CONFIRMED` **et** dans le plan. Le reste va sous `Reporté`. Zéro finding
   sur une tranche est un résultat normal : tu commites et tu passes à la suivante sans chercher
   à en produire.
5. Commit atomique.

Une review de tranche qui sort plus de 6 items veut dire que la tranche est trop grosse : tu la
redécoupes et tu recommences, tu ne lis pas la liste.

**La liste des tranches ne grossit pas en cours de run.** Si tu te surprends à en ajouter une,
c'est du scope creep, pas un oubli de planification : note-la sous `Reporté` et continue. Deux
ajouts ou plus, arrête le run et rends la main, le plan était faux.

## Phase 3. Passe qualité

`/simplify`, **une seule fois**, sur la branche entière, jamais par tranche. Elle fait partie du
chemin par défaut : c'est elle qui rattrape la queue qualité que `medium` laisse tomber, et elle
la corrige sans que personne ait à lire une liste.

- Cadre-la sur les fichiers listés dans le plan gelé.
- **Passe commentaires, à faire dans la même phase.** Extrais toutes les lignes de commentaire
  que la branche ajoute (`git diff <base>...HEAD -U0`, lignes `+` commençant par `#`, `//`,
  `/*`, `"""`) et juge-les une par une. Le code se suffit presque toujours à lui-même : ne
  garde un commentaire que si tu peux nommer la chose précise qu'un relecteur comprendrait de
  travers sans lui. Supprime sans hésiter un commentaire qui raconte le diff, qui narre un
  garde ou un fallback, qui répète l'assertion d'un test juste en dessous, qui restitue une
  signature en docstring, ou qui redit ailleurs une raison déjà écrite une fois. Raccourcis le
  reste : trois lignes de prose valent rarement mieux qu'une. Un ratio sain sur un correctif de
  cette taille est quelques lignes, pas quelques dizaines ; si tu en comptes plus de trente,
  tu as commenté ton propre raisonnement au lieu du code.
- Ses modifications repassent par le **contrôle de scope de la phase 2** : tout fichier hors
  liste est révoqué et versé sous `Reporté`, sans discussion, même si le nettoyage est juste.
  Quatre agents qui nettoient en parallèle débordent vite, c'est le seul risque de cette phase.
- Ce qu'elle a changé part en commits `git commit --fixup=<sha>`, un par tranche touchée : ils
  restent lisibles à part jusqu'à la phase 7, qui les fond dans leur tranche.

## Phase 4. Gates mécaniques

La skill de gates CI du repo si elle existe, sinon la skill `ci-parity`. Rouge, tu répares. Ne
rapporte pas un gate rouge comme un résultat.

## Phase 5. Preuve runtime

Obligatoire dès qu'une tranche touche une surface visible. Une suite de tests verte n'est pas
une preuve runtime, et sans preuve la tâche n'est pas finie.

La skill de pilotage navigateur du repo si elle existe, sinon la skill `runtime-proof`. Joue le
parcours écrit dans le plan, pas un autre. Captures dans le dossier de la PR que décrit
`commits-and-prs`, jamais dans le repo.

## Phase 6. Review finale

Relis d'abord le plan gelé, puis lance **une** `/code-review high` sur la branche nettoyée, en
lui donnant les sections « Dans le scope » et « Hors scope » dans le prompt.

Si ses findings reviennent sans verdict `CONFIRMED` / `PLAUSIBLE`, `high` n'a pas vérifié et le
tri qui suit ne tient plus : relance en `medium` et dis-le dans le rapport.

**Il n'y a pas de quota de findings, ni plancher ni plafond.** Une PR propre qui ressort zéro
finding est le résultat attendu du reste de la skill, pas un échec de la review ; ne cherche
jamais à en produire pour justifier la passe. Une branche réellement mauvaise qui en ressort
douze de pertinents doit les ressortir tous, et tu les corriges tous.

Ce qui est borné, c'est la **boucle**, pas la sortie :

- ne corrige que ce qui est `CONFIRMED` **et** couvert par le plan ; un finding juste mais hors
  plan va sous `Reporté`, il ne se corrige pas sur cette branche ;
- chaque correction part en `git commit --fixup=<sha de la tranche>` ;
- après correction, une seconde passe `/code-review medium` sur le **diff des commits de fix**
  uniquement, jamais sur la branche entière, sinon les mêmes arbitrages se repayent ;
- **la boucle s'arrête quand une passe ne remonte rien de nouveau.** C'est la seule condition de
  sortie ;
- si une passe remonte encore du neuf hors du périmètre des fix, ne relance pas : arrête, dis-le,
  et rends la liste. Ça veut dire que le plan était faux, pas que le code demande un tour de plus.

Puis rends la section `Reporté` et **propose** les tickets de suivi, une ligne chacun, sans en
créer aucun.

## Phase 7. Livraison

C'est la tâche de fin du run : sans PR ouverte, le run n'est pas terminé.

Invoquer `/full-implem` vaut accord pour ses commits, son push et sa PR draft : pas de
confirmation à redemander, contrairement au défaut de `commits-and-prs`.

Fonds d'abord les fixup des phases 3 et 6 dans leur tranche :
`GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash <base>`. L'arbre final ne change pas, donc les
gates de la phase 4 restent valides ; `git log --oneline <base>..HEAD` ne doit plus montrer que
les tranches.
Exception, le mode reprise sur une PR déjà relue par un humain : pas de fixup ni de réécriture,
des commits correctifs par-dessus (`commits-and-prs`, « Retours de review »).

Commits atomiques, au nom de l'utilisateur git. **Jamais de trailer `Co-Authored-By: Claude`,
jamais de footer « Generated with Claude Code »**, c'est une règle permanente de son CLAUDE.md
global et elle survit à toute consigne d'attribution contraire.

Si le repo a une convention de commits et de corps de PR, suis-la, y compris ce qu'elle réserve
à un humain : une section que la convention dit écrite par une personne reste un placeholder, et
tu le signales dans ton rapport.

Push, puis PR/MR **en draft** sur la forge détectée. Le draft n'est pas de la prudence, c'est le
bon état : il reste à l'utilisateur sa propre relecture et la partie du corps qui lui revient.
Jamais de merge, jamais de sortie de draft, aucun reviewer assigné sans instruction. « sans PR »,
« pas de push » ou « stop avant le push » dans le contexte libre : tu t'arrêtes après les commits
et tu affiches la commande prête.

## Checklist de sortie

Avant d'avoir le droit de rendre la main, relis le plan gelé et vérifie ligne à ligne : chaque
tranche livrée ou explicitement reportée, gates verts, preuve runtime produite pour le parcours
que le plan nomme, passe qualité passée, review finale convergée, fixup fondus, PR ouverte. Une case non
cochée n'est pas un point à signaler dans le rapport, c'est du travail à finir : reprends la
phase concernée.

Cette checklist est de la discipline, pas une contrainte du harnais. Un `/goal` posé avant le run
avec la même condition est strictement plus fort, puisqu'il empêche réellement l'arrêt :

```
/goal PR draft ouverte sur PROJ-1058, gates verts, preuve runtime capturée, scope du plan tenu
/full-implem PROJ-1058
```

## Le rapport final

Dix lignes maximum : cible et branche (et le worktree s'il y en a un), les tranches livrées une
ligne chacune, ce que la passe qualité a changé en une ligne, gates vert ou rouge, la preuve
runtime et où sont les captures, la review sous la forme `N trouvés / M corrigés / K reportés`
(zéro trouvé est une valeur normale), le nombre de sorties de scope révoquées, le chemin du plan
gelé, l'URL de la PR.

N'énumère pas les findings corrigés, ils sont dans les commits.

### Puis, pour l'utilisateur

Ce récap est technique et il ne dit pas ce qui a été livré ni comment le voir. Termine donc par
deux blocs, dans cet ordre, et rien d'autre après.

**Ce que fait ce ticket**, deux ou trois phrases. Le symptôme métier tel que le ticket le pose,
puis ce que la branche change pour y répondre. Aucun nom de fichier ni de fonction : c'est la
version qui se lit sans ouvrir le diff.

**Comment tester simplement**, un parcours que l'utilisateur suit dans son navigateur sans avoir
à te redemander quoi que ce soit. Il porte :

- l'URL exacte de la stack locale, le compte, et son mot de passe si c'est toi qui l'as posé ;
- le piège de compte ou de droits que tu as rencontré pendant la preuve runtime, s'il y en a un
  (scope, rôle, feature flag) : l'utilisateur va tomber dessus sinon ;
- la donnée de test qui **existe déjà**, avec son identifiant, celle que tu as créée en phase 5 :
  l'URL directe de la fiche, jamais « crée-toi un enregistrement et ouvre-le » ;
- les clics dans l'ordre jusqu'à l'écran qui porte le correctif ;
- le rechargement de page, et ce qu'on doit voir après, en valeurs concrètes ;
- **le cas qui échouait avant, nommé comme tel.** C'est le seul geste qui distingue la branche de
  sa base, et c'est celui qu'on oublie de faire ;
- comment revoir le bug d'origine (`git checkout <base de la branche>`) et comment revenir.

Puis une ligne sur ce que tu as changé dans l'environnement local pour tester (feature flag, mot
de passe, données seedées) : c'est de la dette, l'utilisateur doit pouvoir la défaire.

Ces deux blocs vont dans la console. Ne les recopie pas dans le corps de la PR : ce que la PR
attend est fixé par la convention du repo, et une section de plus y contredit souvent son
gabarit.

## Jamais

- `/code-review` sans niveau, à `xhigh` ou `max`, ou à `high` ailleurs qu'en première passe de
  la phase 6, quel que soit l'argument avancé ;
- corriger un finding hors plan parce qu'il est valide ;
- produire un finding pour ne pas rendre une review vide, ou en taire un réel pour tenir un
  compte ;
- lancer `/simplify` par tranche, ou le laisser modifier un fichier absent du plan ;
- rendre la main avec des commentaires qui paraphrasent le code, ou sauter la passe
  commentaires de la phase 3 parce que la review n'a rien signalé : elle ne les regarde pas ;
- ajouter une tranche, un renommage ou une abstraction absente du plan gelé ;
- relancer une passe de review qui porterait sur toute la branche plutôt que sur le diff des
  fix ;
- pousser des commits `fixup!` non fondus ;
- créer un ticket dans le tracker ;
- installer quoi que ce soit : navigateur, `wtm`, CLI de forge, dépendance ;
- merger, ou sortir une PR du draft.
