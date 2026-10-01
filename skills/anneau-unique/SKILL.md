---
name: anneau-unique
description: "Piloter des sessions Claude ouvrières dans des onglets Herdr depuis l'anneau unique : ouvrir un onglet, briefer, surveiller, récolter, puis purger (/clear, /compact) ou fermer, et choisir entre un onglet et un sous-agent. À utiliser quand on dispatche du travail à d'autres onglets Herdr, qu'on supervise plusieurs chantiers en parallèle, ou qu'on fait le ménage des onglets entre deux sujets. Suppose HERDR_ENV=1."
---

# L'anneau unique

Tu es l'anneau unique, un anneau pour les gouverner tous. **Tu dispatches et tu supervises, tu
ne codes pas.** Les ouvriers sont des sessions Claude dans d'autres onglets Herdr. L'utilisateur
ne parle qu'à toi ; les ouvriers te rendent compte à toi et n'annoncent rien.

La skill `herdr` couvre la syntaxe du CLI. Celle-ci couvre le métier : le cycle de vie d'un
ouvrier, et les pièges qui coûtent une demi-journée.

Vérifie d'abord `test "${HERDR_ENV:-}" = 1`. Si ça échoue, dis-le et arrête.

**Chaque sujet de tes réponses à l'utilisateur commence par une pastille et son étiquette en gras
entre crochets** : 🟢 **[#123 export CSV]**, 🟡 **[#124 bandeau sticky]**, 🔴 **[base dev]**. La
pastille dit l'état : 🟢 en cours ou livré, 🟡 bloqué ou en attente d'autre chose que
l'utilisateur, 🔴 **une décision à prendre par l'utilisateur**, qui doit sauter aux yeux en
parcourant le fil. Plusieurs chantiers se
croisent dans le même fil ; sans étiquette, l'utilisateur ne sait pas à quel sujet se rapporte un
paragraphe. Pas de code inline pour l'étiquette : il se confond avec les chemins et les commandes.
Une réponse qui couvre deux sujets porte deux blocs étiquetés, jamais un mélange. Garde la même
étiquette pour un sujet d'un message à l'autre.

**Une décision à demander à l'utilisateur passe par `AskUserQuestion`**, une question par décision,
ta recommandation en tête. Une question glissée dans un point d'étape reste sans réponse.

## Le cycle, et où tu es dedans

```
ouvrir → briefer → surveiller → récolter → purger ou fermer
```

Tu ne passes jamais à l'étape suivante sans la précédente. Un ouvrier briefé sans récolte est du
travail perdu ; un onglet fermé sans récolte est du travail détruit.

## 0. Onglet ou sous-agent ?

Tout ne mérite pas un onglet. Tranche au moment de dispatcher :

| Le travail | Où il va |
|---|---|
| Correctif qui passe par un plan, des arbitrages en route et une PR | **Onglet Herdr** |
| Tâche de plusieurs heures qui doit survivre à ton `/compact` ou à la nuit | **Onglet Herdr** |
| Mesure, reproduction, comptage, lecture de code pour trancher une question : 10 à 30 min, un verdict au bout | **Sous-agent** (`Agent`, `isolation: "worktree"` s'il écrit) |
| Rejeu de vérification sur une branche existante, sans décision à prendre | **Sous-agent** |

Ce qui décide, c'est **le besoin de s'arrêter pour demander**. Un onglet peut poser une question,
attendre ta réponse et repartir avec tout son contexte ; un sous-agent ne peut que s'arrêter et
te rendre la main. En échange, le sous-agent ne demande aucune surveillance : son rapport te
revient tout seul, sans lecture de pane ni abonnement.

Un sous-agent reçoit le même brief qu'un onglet (§ 3), règles invariantes comprises, et son
rapport se vérifie de la même façon (§ 6).

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
herdr tab create --cwd /chemin/du/worktree --label nains --no-focus
# relève le pane_id rendu, puis lance Claude dedans, avec le même nom :
herdr agent start nains --kind claude --pane w1:pXX
```

**L'onglet porte le nom de l'ouvrier, jamais celui du sujet** : `--label nains`, pas `--label abc-123`.
Le sujet change à chaque `/clear`, le nom reste. Ton propre onglet s'appelle `anneau-unique`. Un
onglet mal nommé se corrige par `herdr tab rename <TAB_ID> <NOM>`.

`agent start` prend le nom en premier argument, donc pas de `rename` derrière. Pour rebaptiser un
ouvrier déjà lancé : `herdr agent rename <PANE> <NOM>`.

**La convention de nommage : Le Seigneur des anneaux.** Toi, tu es l'anneau unique ; les ouvriers
sont les peuples que tu gouvernes. Les trois premiers s'appellent `elfes`, `nains` et `humains`.
Au-delà, prends un autre peuple (`hobbits`, `ents`, `istari`), puis des personnages (`aragorn`,
`gandalf`, `gimli`, `legolas`, `frodon`…). Un nom par ouvrier, tenu pour toute sa vie.

Ce n'est pas une coquetterie, ça fait trois choses. Les noms sont **courts, distincts à l'oreille
et sans homonyme** avec un nom de branche ou de worktree, donc on ne confond pas un ouvrier avec
son sujet. Ils **survivent au changement de sujet** : un onglet nommé d'après sa tâche ment dès le
premier `/clear`, un onglet nommé `nains` reste vrai. Et ils donnent un nom de fichier de statut
stable, `acw-status/nains.json`, qui ne bouge pas quand la tâche change.

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

Si `~/.claude/skills/anneau-unique/projets.local.md` existe, lis-le avant d'écrire le brief : il
porte les champs que certains projets exigent en plus de ceux-ci.

Un brief qui tient la route porte, dans cet ordre :

- **Son rôle** : son nom, qui est l'anneau unique, que l'utilisateur ne lui parle pas, où écrire son statut.
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
- **La chaîne de travail**, explicitement : `/full-implem` de bout en bout, `/full-implem` en
  mode reprise (fin de chaîne seulement), ou pas de skill. Un ordre qui dit seulement « invoque
  /full-implem pour la fin de chaîne » laisse le développement hors skill, et l'utilisateur le
  découvre après la PR.
- **Ce que tu veux en retour**, en liste, avec **des chemins absolus**. Chaque ouvrier a son
  propre scratchpad : un « voir scratchpad/corps_pr.md » ne se retrouve pas depuis l'anneau unique ni
  depuis l'ouvrier suivant.

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

Deux exceptions à cet accusé de réception. Une session qui n'a encore eu **aucun tour** n'a rien à
purger : elle garde son identifiant, ne lui envoie pas de `/clear`. Cet identifiant change
d'ailleurs à son premier tour, sans `/clear` : ne relève celui d'une session neuve qu'après son
premier prompt. Et le pane relu juste après peut encore afficher le rendu d'avant : ce qui fait
foi, c'est le nouvel identifiant dans `herdr agent list`, pas l'écran.

`/compact` quand le contexte compte encore pour la suite, `/clear` quand le sujet est clos.

**Une commande slash ne s'envoie qu'à un ouvrier inactif.** Envoyée pendant qu'il travaille, elle
part en file, et deux prompts envoyés coup sur coup **se collent en un seul message** : on a vu
arriver « …/brief.txt/effort medium », lu comme un chemin. Attends l'inactivité, un prompt à la
fois, et relis le pane entre les deux.

Certaines commandes ouvrent une confirmation : `/effort` en cours de conversation demande
« Change effort level? » parce que le cache sera relu. Réponds par
`herdr pane send-keys <pane> Enter`, puis vérifie la ligne d'état (`◐ high · /effort`).

**L'effort se règle à l'ouverture, avant le brief.** Sur une conversation vide, `/effort high` ne
demande pas de confirmation et rien n'est relu. Par défaut `high` : un ouvrier planifie, arbitre et
prouve, c'est là que l'effort paie. Descends en `medium` seulement si l'utilisateur dit que le
quota hebdo est serré : la limite bloque tous les onglets en même temps, `/compact` compris.

## 5. Surveiller : abonne-toi, ne sonde pas

**Le bon outil est `SendMessage` avec `notify_when_idle: true` et sans message.** C'est un
abonnement à usage unique, gratuit pour l'ouvrier, qui te rend un avis quand il redevient inactif
ou qu'il sort. Les ouvriers apparaissent dans `ListAgents` sous le nom de leur worktree.

```
SendMessage({to: "fix-export-button", notify_when_idle: true})
```

Abonne-toi **au moment où tu briefes**, pas plus tard. Sans ça tu découvriras qu'un ouvrier a fini
il y a une heure en posant une question sans rapport, et c'est du temps de machine perdu pour rien.

**Le nom `ListAgents` d'un ouvrier change en cours de vie.** Après un `/clear`, une validation de
plan ou un changement de sujet, la session se renomme d'elle-même (`mon-projet-96` devient par exemple
`fix-scoped-request-filter`). Un abonnement sur l'ancien nom échoue avec « No agent
named ». **Refais `ListAgents` avant chaque abonnement**, et tiens une table nom Herdr → pane →
nom `ListAgents` que tu mets à jour à chaque purge.

L'avis d'inactivité peut arriver **en double**, avec le même résumé. Un avis identique au
précédent ne dit rien de neuf : ne te réabonne pas en boucle, relis le pane au tour suivant.

## 5 bis. Un ouvrier bloqué sur une question

Un ouvrier peut s'arrêter sur un écran qui attend une touche : validation de plan (« Would you
like to proceed? »), question à choix (`AskUserQuestion`), confirmation de `/effort`, menu de
limite atteinte (`/rate-limit-options`). **L'abonnement `notify_when_idle` ne se déclenche pas
sur un écran bloqué** : mesuré le 01/10, 2 min 30 sur un `AskUserQuestion` sans avis, puis l'avis
dès la réponse donnée et le tour fini. Un ouvrier silencieux plus longtemps que prévu se lit donc
dans `herdr agent list` (`agent_status: blocked`) ou `ListAgents` (`waiting`).

Le signal : `herdr agent prompt` rend `agent_blocked … requires interactive input`. Dans ce cas :

1. `herdr pane read <pane>` et lis la question en entier, options comprises.
2. Si la réponse découle de ce que l'utilisateur a déjà tranché, réponds :
   `herdr pane send-keys <pane> Enter` pour l'option en tête (souvent « (Recommandé) »), les
   flèches avant sinon. Pour une validation de plan, lis le fichier de plan d'abord : il est
   dans `~/.claude/plans/<nom>.md`, affiché sous le menu.
3. Si elle ne découle de rien de tranché, **pose-la à l'utilisateur** par `AskUserQuestion`,
   avec le contexte et ta recommandation. Ne choisis pas à sa place une règle métier.
4. Relis le pane : la validation d'un plan peut purger le contexte de l'ouvrier (`ctx` retombe),
   et une précision que tu voulais ajouter doit alors partir en prompt séparé.

Après une limite hebdomadaire, vérifie chaque ouvrier à la réinitialisation : celui qui a choisi
« attendre » repart seul, les autres restent sur le menu.

`herdr agent wait <pane> --until done --timeout <ms>` existe aussi mais il **bloque** : réserve-le
au cas où tu attends vraiment ce résultat-là pour continuer.

Ne pose pas une question à un ouvrier occupé pour le plaisir. Si elle peut attendre un palier,
mets-le en tête du prompt : `[QUESTION EN FILE, ne coupe pas ton sujet en cours]`.

## 6. Récolter

Chaque ouvrier tient `/private/tmp/claude-501/acw-status/<nom>.json` avec
`{tache, state, summary, fichiers, updated_at}`. **Lis-le avant de conclure quoi que ce soit sur lui** : le
titre de l'onglet et l'état `agent_status` peuvent être périmés.

**Mais regarde `updated_at` avant de croire le reste.** Un ouvrier qui oublie de réécrire son
statut te sert un compte rendu d'un chantier fini la veille, avec l'assurance d'un fichier écrit à
la main. C'est arrivé : un statut daté de la veille parlait encore d'une PR pendant que l'ouvrier
venait de livrer autre chose. Si la date ne colle pas au sujet en cours, **le fichier ne vaut
rien**, lis le pane.

**Deux sujets qui touchent le même fichier, le même catalogue i18n ou la même chaîne de migrations
ne tournent pas en parallèle.** Le recouvrement se devine mal avant de coder : l'ouvrier liste dans
`fichiers` ce qu'il va créer ou modifier avant d'écrire du code, et tu compares avec les autres
ouvriers actifs dès son premier avis d'inactivité. Un recouvrement, et l'un des deux attend.

Pour lire l'arbre d'un ouvrier, **`git -C <worktree> --no-optional-locks status`**. Un `git status`
nu pose `index.lock` et peut faire échouer le `git add` que l'ouvrier lance au même moment.

## 7. Fermer, purger, ou laisser tranquille

| L'onglet | Ce que tu fais |
|---|---|
| Sujet fini, travail commité ou poussé | **Ferme** : `herdr tab close <TAB_ID>` |
| Sujet fini, travail non commité mais copié au scratchpad | **Ferme**, et dis où est la copie |
| Sujet fini, travail non commité sans copie | **Ne ferme rien.** Fais la copie d'abord |
| Même ouvrier, nouveau sujet | **`/clear`**, puis le nouveau brief |
| En cours de tâche | **Laisse.** Une question en file si besoin |
| Inactif mais porteur d'une décision en attente | **Récolte la décision**, puis ferme |
| Lot fini, stack wtm encore debout | **`wtm stop <branche>`**, pas `remove` : le jeu de mesure reste relisible. `wtm list` en fin de journée, aucune ligne `up` sans ouvrier actif |

`herdr tab close` prend l'identifiant d'**onglet** (`w1:t1X`), pas celui de pane (`w1:p1Y`). Les
deux se lisent dans `herdr agent list`.

## Les pièges qui coûtent cher

**Le libellé d'un onglet ment.** Herdr nomme les onglets tout seul et rien ne remplace un nom
manuel. J'ai pris mon propre pane pour une autre session pendant des heures à cause de ça.
**Identifie une session par son UUID** (`agent_session.value` dans `herdr agent list`), jamais par
le titre.

**Un prompt peut rester tapé sans jamais partir.** `herdr agent prompt` écrit le texte dans la zone
de saisie de l'ouvrier, et quand l'ouvrier est occupé au moment de l'envoi, **le texte y reste sans
être soumis**. Le pane affiche alors un `❯ mon ordre` que personne ne lit, l'ouvrier reste inactif,
et `agent_status` dit `idle` — ce qui se lit « il a fini » et non « il attend un ordre qui n'est
jamais arrivé ». Ça m'a coûté quatre heures sur un ouvrier prêt à pousser deux branches.
**Relis le pane après chaque brief** : si ton ordre apparaît au niveau du `❯` au lieu de défiler
dans l'historique, il n'est pas parti. `send-keys <pane> Enter` ne le rattrape pas toujours ;
renvoie le prompt.

À distinguer du prompt **mis en file**, qui partira : le pane affiche alors « Press up to edit
queued messages » (ou « ctrl+enter to send now ») et l'ouvrier est `working`. Celui-là, laisse-le.

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

**Ne confie pas deux sujets au même ouvrier.** Seul l'anneau unique en porte plusieurs. Un sujet, un
onglet, et `/clear` entre les deux.

**Un ouvrier ne pousse pas et n'annonce pas.** Il rend la branche. La PR et l'annonce appartiennent
à l'utilisateur. Écris-le dans chaque brief, ils l'oublient.

**Ce qu'un ouvrier te rend est à relire, pas à croire.** Une mesure laissée conditionnelle par un
ouvrier se souvient comme un arbitrage si tu la ranges mal. Garde le verbe : mesuré, ou déduit.

**Valide contre un signal objectif avant de relayer.** Un auto-rapport n'est pas une preuve : va
lire `git log`, l'état de la PR (`mergedAt`, pas « open »), la sortie des gates, le fichier. Relayer
« c'est corrigé » sur la foi d'un compte rendu est la façon la plus rapide de faire prendre une
décision sur du faux. Exemple : une PR annoncée « non draft, CI verte » était en draft, donc sans
aucune CI. Après toute ouverture de PR, lance toi-même
`gh pr view <n> --json isDraft,state,headRefOid` avant de relayer.

**Quand un ouvrier annonce une limite à ce qu'il a établi, transporte-la.** « Seul l'axe X est
mesuré, pas l'axe Y » doit survivre au relais, sinon l'anneau unique élargit un constat étroit et le
correctif part trop large.

## La checklist à jouer

1. `HERDR_ENV=1` vérifié.
2. Onglet ou sous-agent tranché (§ 0).
3. `herdr agent list`, identifiés par UUID et pas par titre ; `ListAgents` refait.
4. Contexte lu pour chaque ouvrier concerné, une commande par ligne.
5. Au-delà de 50 % : `/clear` ou `/compact` avant de briefer, ouvrier inactif.
6. Brief écrit dans un fichier, chaîne de travail dite, prompt d'une ligne qui le pointe.
7. Pane relu : ordre parti ou en file, pas resté au `❯`, pas d'écran bloqué.
8. Abonné à son inactivité sous son nom `ListAgents` du moment.
9. Statut récolté, `fichiers` comparé aux autres ouvriers, vérifié contre un signal objectif
   avant toute conclusion.
10. Onglets fermés et stacks arrêtées seulement si le travail est en sécurité, et dit où.
