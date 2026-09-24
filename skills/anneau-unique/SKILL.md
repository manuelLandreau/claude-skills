---
name: anneau-unique
description: "Piloter des sessions Claude ouvrières dans des onglets Herdr depuis une session maître : ouvrir un onglet, briefer, surveiller, récolter, puis purger (/clear, /compact) ou fermer. À utiliser quand on dispatche du travail à d'autres onglets Herdr, qu'on supervise plusieurs chantiers en parallèle, ou qu'on fait le ménage des onglets entre deux sujets. Suppose HERDR_ENV=1."
---

# L'anneau unique

Tu es la session maître. **Tu dispatches et tu supervises, tu ne codes pas.** Les ouvriers sont des
sessions Claude dans d'autres onglets Herdr. L'utilisateur ne parle qu'à toi ; les ouvriers te
rendent compte à toi et n'annoncent rien.

La skill `herdr` couvre la syntaxe du CLI. Celle-ci couvre le métier : le cycle de vie d'un
ouvrier, et les pièges qui coûtent une demi-journée.

Vérifie d'abord `test "${HERDR_ENV:-}" = 1`. Si ça échoue, dis-le et arrête.

## Le cycle, et où tu es dedans

```
ouvrir → briefer → surveiller → récolter → purger ou fermer
```

Tu ne passes jamais à l'étape suivante sans la précédente. Un ouvrier briefé sans récolte est du
travail perdu ; un onglet fermé sans récolte est du travail détruit.

## 1. Avant tout brief : lis le contexte de l'ouvrier

```bash
herdr agent read w1:p1Y | grep -oE 'ctx:[0-9.]+%' | tail -1
```

**Au-delà de 50 %, purge avant de briefer**, sinon le brief se dilue dans un sujet qui n'est plus
le sien. La ligne `ctx:` disparaît après un `/clear` : c'est ton accusé de réception.

Une seule commande par ouvrier, chacune sur sa ligne. **Ne boucle pas** : dans une session isolée
en worktree, le garde-fou refuse tout `for` / `while read` qui fait tourner un binaire avec une
valeur calculée à l'exécution, il ne peut pas prouver que ce n'est pas `git`.

## 2. Ouvrir un onglet

Un onglet neuf est un shell, pas un agent. Deux temps :

```bash
herdr tab create --cwd /chemin/du/worktree --label sujet-court --no-focus
# relève le pane_id rendu, puis lance Claude dedans, avec son nom :
herdr agent start gimli --kind claude --pane w1:pXX
```

`agent start` prend le nom en premier argument, donc pas de `rename` derrière. Pour rebaptiser un
ouvrier déjà lancé : `herdr agent rename <PANE> <NOM>`. Nomme-les toujours : le libellé
automatique de l'onglet ne se règle pas et il finit par mentir.

**La convention de nommage : Le Seigneur des anneaux.** Le maître est « L'anneau unique ». Chaque
ouvrier porte un nom de personnage, un seul, tenu pour toute sa vie : `aragorn`, `boromir`,
`faramir`, `gandalf`, `gimli`, `legolas`, et les collectifs `elfes` et `nains` quand plusieurs
sessions partagent un chantier.

Ce n'est pas une coquetterie, ça fait trois choses. Les noms sont **courts, distincts à l'oreille
et sans homonyme** avec un nom de branche ou de worktree, donc on ne confond pas un ouvrier avec
son sujet. Ils **survivent au changement de sujet** : un onglet nommé d'après sa tâche ment dès le
premier `/clear`, un onglet nommé `gimli` reste vrai. Et ils donnent un nom de fichier de statut
stable, `acw-status/gimli.json`, qui ne bouge pas quand la tâche change.

Reprends un nom libre avant d'en inventer un. Deux ouvriers homonymes, et tu brieferas le mauvais.

N'ouvre un onglet que si aucun ouvrier n'est libre. **Une session neuve coûte souvent une stack**,
donc regarde la charge machine avant (swap, nombre de conteneurs). Un défaut applicatif ordinaire se
reproduit sur n'importe quelle stack déjà debout : confie-le à qui en a une.

## 3. Briefer

**Le garde-fou lit le texte du prompt, pas seulement la commande.** Un prompt qui contient « pousse
la branche » est refusé, parce qu'il ne peut pas prouver que ce que tu lances n'est pas git. Le
vocabulaire git dans un ordre suffit à bloquer, même quand la commande est `herdr`.

Donc, systématiquement : **écris l'ordre dans un fichier du scratchpad, et prompte une ligne sans
vocabulaire git :**

```bash
herdr agent prompt w1:p1Y "Lis et execute /chemin/scratchpad/brief-sujet.txt"
```

Un brief qui tient la route porte, dans cet ordre :

- **Son rôle** : son nom, qui est le maître, que l'utilisateur ne lui parle pas, où écrire son statut.
- **« Nouveau sujet »** explicite quand c'en est un, et ce que devient le sujet précédent.
- **Le constat mesuré**, avec les chiffres et les chemins de fichiers, pas une paraphrase.
- **Ce qui est déjà établi et qu'il ne doit pas remesurer**, et quoi faire si ça tombe quand même.
- **La limite de ce qui est établi**, nommément, pour qu'il ne l'élargisse pas.
- **Le piège** qui va l'arrêter au bout de vingt minutes, dit d'avance.
- **Hors périmètre, nommément**, à reprendre tel quel dans le corps de la PR.
- **La preuve attendue**, avec son contrôle de polarité inverse.
- **Les règles qui ne changent pas** : ne les recopie pas, **cite le fichier**
  `~/.claude/skills/anneau-unique/regles-invariantes.md` et demande-lui de le lire. Recopier à la
  main fabrique une dérive entre deux briefs, et c'est toujours la règle oubliée qui coûte.
- **Ce que tu veux en retour**, en liste.

Quand la question produit n'est pas tranchée, **dis-lui de s'arrêter et de te rendre des options
chiffrées**. Un ouvrier qui invente une règle métier livre un défaut de plus.

## 4. Purger : `/clear` et `/compact` passent par `prompt`, pas par `send-keys`

`send-keys` ne prend que des **noms de touches** (`Enter`, `esc`). `send-keys <pane> "/clear"` rend
`unsupported key`. La bonne commande :

```bash
herdr agent prompt w1:p1Y "/clear"
```

Après un `/clear`, l'identifiant de session de l'ouvrier **change**. Ne t'accroche pas à l'ancien.
Enchaîne ensuite sur le prompt qui pointe le nouveau brief.

`/compact` quand le contexte compte encore pour la suite, `/clear` quand le sujet est clos.

## 5. Surveiller : abonne-toi, ne sonde pas

**Le bon outil est `SendMessage` avec `notify_when_idle: true` et sans message.** C'est un
abonnement à usage unique, gratuit pour l'ouvrier, qui te rend un avis quand il redevient inactif
ou qu'il sort. Les ouvriers apparaissent dans `ListAgents` sous le nom de leur worktree.

```
SendMessage({to: "fix-export-button", notify_when_idle: true})
```

Abonne-toi **au moment où tu briefes**, pas plus tard. Sans ça tu découvriras qu'un ouvrier a fini
il y a une heure en posant une question sans rapport, et c'est du temps de machine perdu pour rien.

`herdr agent wait <pane> --until done --timeout <ms>` existe aussi mais il **bloque** : réserve-le
au cas où tu attends vraiment ce résultat-là pour continuer.

Ne pose pas une question à un ouvrier occupé pour le plaisir. Si elle peut attendre un palier,
mets-le en tête du prompt : `[QUESTION EN FILE, ne coupe pas ton sujet en cours]`.

## 6. Récolter

Chaque ouvrier tient `/private/tmp/claude-501/acw-status/<nom>.json` avec
`{tache, state, summary, updated_at}`. **Lis-le avant de conclure quoi que ce soit sur lui** : le
titre de l'onglet et l'état `agent_status` peuvent être périmés.

**Mais regarde `updated_at` avant de croire le reste.** Un ouvrier qui oublie de réécrire son
statut te sert un compte rendu d'un chantier fini la veille, avec l'assurance d'un fichier écrit à
la main. C'est arrivé : un statut daté de la veille parlait encore d'une PR pendant que l'ouvrier
venait de livrer autre chose. Si la date ne colle pas au sujet en cours, **le fichier ne vaut
rien**, lis le pane.

## 7. Fermer, purger, ou laisser tranquille

| L'onglet | Ce que tu fais |
|---|---|
| Sujet fini, travail commité ou poussé | **Ferme** : `herdr tab close <TAB_ID>` |
| Sujet fini, travail non commité mais copié au scratchpad | **Ferme**, et dis où est la copie |
| Sujet fini, travail non commité sans copie | **Ne ferme rien.** Fais la copie d'abord |
| Même ouvrier, nouveau sujet | **`/clear`**, puis le nouveau brief |
| En cours de tâche | **Laisse.** Une question en file si besoin |
| Inactif mais porteur d'une décision en attente | **Récolte la décision**, puis ferme |

`herdr tab close` prend l'identifiant d'**onglet** (`w1:t1X`), pas celui de pane (`w1:p1Y`). Les
deux se lisent dans `herdr agent list`.

## Les pièges qui coûtent cher

**Le libellé d'un onglet ment.** Herdr nomme les onglets tout seul et rien ne remplace un nom
manuel. J'ai pris mon propre pane pour une autre session pendant des heures à cause de ça.
**Identifie une session par son UUID** (`agent_session.value` dans `herdr agent list`), jamais par
le titre.

**Un ouvrier « done » n'est pas un ouvrier vide.** Il peut tenir un correctif non commité. Vérifie
son statut et son worktree avant de le purger.

**Vérifie dans quel arbre l'ouvrier travaille, pas seulement son nom.** Le `cwd` d'un pane peut
être le **checkout principal**, qui ne doit jamais être touché. Croise `herdr agent list` avec
`git worktree list` : une branche qui n'apparaît dans aucun worktree a été fabriquée ailleurs, et
« ailleurs » est souvent le checkout principal revenu depuis sur sa branche par défaut. Fais-le
**avant** de briefer, pas au moment de récolter.

**Tu ne peux pas pousser à la place d'un ouvrier.** Une session isolée en worktree ne fait pas de
git hors du sien : le push, le rebase et le commit **se confient à celui qui tient l'arbre**. Si
cet ouvrier est déjà reparti sur un autre sujet, la commande attend, elle ne se contourne pas.

**Ne confie pas deux sujets au même ouvrier.** Seul le maître en porte plusieurs. Un sujet, un
onglet, et `/clear` entre les deux.

**Un ouvrier ne pousse pas et n'annonce pas.** Il rend la branche. La PR et l'annonce appartiennent
à l'utilisateur. Écris-le dans chaque brief, ils l'oublient.

**Ce qu'un ouvrier te rend est à relire, pas à croire.** Une mesure laissée conditionnelle par un
ouvrier se souvient comme un arbitrage si tu la ranges mal. Garde le verbe : mesuré, ou déduit.

**Valide contre un signal objectif avant de relayer.** Un auto-rapport n'est pas une preuve : va
lire `git log`, l'état de la PR (`mergedAt`, pas « open »), la sortie des gates, le fichier. Relayer
« c'est corrigé » sur la foi d'un compte rendu est la façon la plus rapide de faire prendre une
décision sur du faux.

**Quand un ouvrier annonce une limite à ce qu'il a établi, transporte-la.** « Seul l'axe X est
mesuré, pas l'axe Y » doit survivre au relais, sinon le maître élargit un constat étroit et le
correctif part trop large.

## La checklist à jouer

1. `HERDR_ENV=1` vérifié.
2. `herdr agent list`, identifiés par UUID et pas par titre.
3. Contexte lu pour chaque ouvrier concerné, une commande par ligne.
4. Au-delà de 50 % : `/clear` ou `/compact` avant de briefer.
5. Brief écrit dans un fichier, prompt d'une ligne qui le pointe.
6. Statut récolté avant toute conclusion sur un ouvrier.
7. Onglets fermés seulement si le travail est en sécurité, et dit où.
