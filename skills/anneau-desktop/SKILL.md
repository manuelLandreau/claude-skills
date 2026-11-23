---
name: anneau-desktop
description: "À utiliser quand on pilote, depuis Claude Code Desktop, des sessions Claude camarades lancées comme sessions liées (start_session) : dispatcher plusieurs chantiers en parallèle, briefer, surveiller, récolter, archiver, choisir entre une session liée et un sous-agent. Équivalent Desktop de la skill anneau-unique (Herdr), sans panes ni HERDR_ENV."
---

# L'anneau unique, version Desktop

Tu es l'anneau unique. **Tu dispatches et tu supervises, tu ne codes pas.** Les camarades sont des
**sessions liées** de l'app Desktop, lancées par `start_session`. Elles apparaissent sous la tienne
dans la barre latérale, et la note « Linked sessions now » te donne leurs noms, ids et états.
L'utilisateur ne parle qu'à toi. Les camarades te rendent compte à toi et n'annoncent rien.

Prérequis : `mcp__ccd_session__start_session` existe dans la session, chargé ou différé. S'il est
différé, charge-le en un seul `ToolSearch` avec `SendMessage`, `ListAgents`,
`mcp__ccd_session_mgmt__list_sessions` et `mcp__ccd_session_mgmt__archive_session`. S'il est absent, ce n'est
pas l'app Desktop : dis-le et arrête.

**Chaque sujet de tes réponses commence par une pastille et son étiquette entre crochets, en gras
et en majuscules** : 🟢 **[#123 EXPORT CSV]**, 🟡 **[#124 BANDEAU STICKY]**, 🔴 **[BASE DEV]**.
- 🟢 : en cours ou livré.
- 🟡 : bloqué, ou en attente d'autre chose que l'utilisateur.
- 🔴 : une décision à prendre par l'utilisateur.

Pas de code inline pour l'étiquette. Deux sujets dans une réponse, deux blocs. L'étiquette reste
la même d'un message à l'autre. Cite un camarade avec son lien, `[titre](#local_<id>)`.

**Une décision à demander passe par `AskUserQuestion`**, une question par décision, ta
recommandation en tête.

## Le cycle

```
lancer → (briefer, dans le même appel) → surveiller → récolter → archiver   (un sujet = une session)
```

Pas d'étape sautée. Une session archivée sans récolte, c'est du travail détruit : l'archivage
nettoie son worktree.

## 0. Session liée ou sous-agent ?

| Le travail | Où il va |
|---|---|
| Correctif qui passe par un plan, des arbitrages en route et une PR | **Session liée** |
| Tâche de plusieurs heures, qui doit survivre à ton `/compact` ou à la nuit | **Session liée** |
| Mesure, reproduction, lecture de code pour trancher : 10 à 30 min, un verdict au bout | **Sous-agent** (`Agent`, avec `isolation: "worktree"` s'il écrit) |
| Rejeu de vérification sur une branche existante, sans décision | **Sous-agent** |

Ce qui décide, c'est le besoin de s'arrêter pour demander. Une session liée peut finir son tour
sur une question, recevoir ta réponse et repartir avec son contexte. Un sous-agent ne peut que
rendre la main.

## 1. Nouveau sujet, nouvelle session

Un nouveau sujet part dans une session neuve, jamais dans une session qui porte déjà un autre
sujet. Même sujet = même branche : retours de review, CI rouge, preuve manquante. Le ticket
suivant de la même epic est un nouveau sujet.

**Lance un camarade seulement pendant un tour ouvert par un message de l'utilisateur.** L'app
refuse `start_session` sur un tour ouvert par un `<side-sessions-event>` ou un autre automatisme.
La seule exception : une étape que l'utilisateur a demandée en toutes lettres plus tôt dans la
conversation (« enchaîne OP-901 après OP-900 »), et seulement dans ce projet.
Ailleurs (autre repo, autre worktree), propose une carte (`initiation: "own_initiative"`) que
l'utilisateur démarre d'un clic. Un enchaînement « quand gimli a fini, lance le suivant » ne
tient donc pas tout seul. Dis-le à l'utilisateur au moment où tu le prévois.

## 2. Lancer un camarade

Un seul appel, le brief compris :

```
start_session({
  initiation: "user_asked",       // l'utilisateur a demandé ce chantier en parallèle
  context: "fresh",
  name: "gimli",                  // [a-z0-9-], 24 car. max : le nom du camarade, jamais le sujet
  title: "OP-871 schéma replacement_request",
  prompt: "<le brief, § 3>",
  background: "<≥ 80 car. : objectif d'ensemble, décisions prises, place de ce morceau>",
  effort: "high",                 // omis = hérite du tien ; jamais au-dessus ; medium si quota serré
  // l'un des deux :
  use_worktree: true, source_branch: "feat/...",          // worktree neuf coupé d'une branche
  cwd: "/chemin/worktree/existant", use_worktree: false   // dossier existant, nommé par l'utilisateur
})
```

**`cwd` seulement si l'utilisateur a nommé le dossier**, dans son message ou en réponse à ton
`AskUserQuestion`. C'est la voie pour reprendre un worktree wtm dont la stack et la base existent
déjà. Si l'app demande à l'utilisateur de faire confiance au dossier, la session ne démarre
qu'après son clic : dis-le-lui, et relis le résultat de l'outil. Sans dossier nommé,
le camarade part sur `use_worktree: true`. Pour reprendre un worktree existant, demande-le.

Ne passe pas `permission_mode`, laisse le camarade hériter du tien. **Une session dans un autre
mode que le tien garde tes messages en attente de l'approbation de l'utilisateur**, et peut les
laisser expirer.

**Le nom** suit la convention du Seigneur des anneaux : la Communauté d'abord (`frodon`, `sam`,
`gandalf`, `aragorn`, `legolas`, `gimli`, `boromir`, `merry`, `pippin`), puis `faramir`, `eowyn`,
`elrond`, `galadriel`… Sans accent, un nom par camarade pour toute sa vie. Les noms pris se lisent
dans `list_sessions({linked: true})` (champ `name`). Un camarade archivé libère son nom. Ce nom est aussi celui de son fichier de statut.

Pour montrer un camarade à côté de toi : `mcp__ccd_window__open_session_in` (split view).

## 3. Le brief

Si `~/.claude/skills/anneau-unique/projets.local.md` existe, lis-le avant d'écrire : il porte les
champs que certains projets exigent en plus.

Le brief porte, dans cet ordre :

- **Son rôle** : son nom, que tu es l'anneau unique, que l'utilisateur ne lui parle pas, où écrire son statut.
- **Le constat mesuré**, avec chiffres et chemins, pas une paraphrase.
- **Ce qui est établi et à ne pas remesurer**, et quoi faire si ça tombe quand même.
- **La limite de ce qui est établi**, nommément.
- **Le piège** qui l'arrêtera au bout de vingt minutes, dit d'avance.
- **Hors périmètre, nommément**, à reprendre tel quel dans le corps de la PR.
- **La preuve attendue**, avec son contrôle de polarité inverse.
- **Les règles invariantes** : cite `~/.claude/skills/anneau-unique/regles-invariantes.md` et
  demande-lui de le lire. Ne recopie pas.
- **La chaîne de travail**, explicitement : `/full-implem` de bout en bout, `/full-implem` en
  reprise (fin de chaîne seulement), ou pas de skill.
- **Ce que tu veux en retour**, en liste, avec des chemins absolus.
- **Le paragraphe « ne bloque jamais »**, mot pour mot :

  > Tu tournes sans personne devant ton écran : l'anneau unique ne peut ni cliquer ni répondre à
  > un écran interactif. N'utilise ni `AskUserQuestion`, ni le mode plan, ni les boutons de
  > `wrap_up`. Quand tu as une question ou un plan à faire valider, écris-le dans ton fichier de
  > statut avec `state: "question"`, termine ton tour avec la question en dernière ligne, et
  > attends : la réponse arrivera comme un message.

  Le prompt système de l'app pousse un camarade vers ces écrans. Sans ce paragraphe, il s'y arrête
  et seul l'utilisateur peut le débloquer.

Quand la question produit n'est pas tranchée, dis-lui de s'arrêter et de rendre des options
chiffrées.

Plus de fichier de brief ni de prompt d'une ligne : le brief passe dans le paramètre `prompt`,
que le garde-fou Bash ne lit pas.

## 4. Parler à un camarade en cours de route

`SendMessage({to: "<nom ListAgents>", message: "..."})`. Les sessions Desktop sont listées par
`ListAgents`. Le résultat dit `delivered` (son tour démarre) ou `queued` (il partira après le tour
en cours). Un message en file ne se perd pas, contrairement au prompt Herdr resté au `❯`.

Mets la première ligne au clair : c'est tout ce que l'utilisateur voit en aperçu. Une question
qui peut attendre commence par `[QUESTION EN FILE, ne coupe pas ton sujet en cours]`.

**`/compact` se tape dans la session du camarade.** Pour la suite d'un sujet au-delà de 50 % de
contexte, demande-le à l'utilisateur, camarade inactif, avec le lien de la session. Qu'un `/compact`
envoyé par `SendMessage` s'exécute comme commande n'est pas vérifié, et `delivered` ne le prouve
pas.

## 5. Surveiller : ne sonde pas

L'app te réveille seule par un `<side-sessions-event>`, quand **tous** tes camarades ont fini
leur tour et que tu es inactif. Ce qu'il faut savoir :

- **Le réveil est groupé.** Avec trois camarades, le premier qui finit attend les deux autres.
  Pour être réveillé par un camarade précis, abonne-toi :
  `SendMessage({to: "<nom ListAgents>", notify_when_idle: true})`, sans message. Les sessions
  Desktop sont dans `ListAgents` (mesuré). Que l'avis arrive bien pour elles n'est **pas encore
  vérifié** : relève-le la première fois. S'il ne vient pas, le réveil groupé et
  `list_sessions` au tour suivant de l'utilisateur restent.
- Après plusieurs réveils d'affilée sans message de l'utilisateur, les notes attendent ton tour
  suivant.
- La note de réveil cite les 400 premiers caractères de son rapport. **C'est un extrait, pas une
  preuve** : la récolte (§ 6) reste à faire.
- L'état de chacun : `mcp__ccd_session_mgmt__list_sessions({linked: true})`, ou la note « Linked
  sessions now ». Jamais en boucle.

### Un camarade bloqué malgré le brief

Une session dans l'état `waiting` attend l'utilisateur : une demande de permission, une
validation de plan qu'une skill a ouverte, une question. `list_sessions` ne donne pas la cause.
Le fichier de statut la donne parfois, sinon seul l'écran de la session la montre.
**Tu ne peux pas y répondre.**
- Tant qu'elle attend, ne fais pas son travail à sa place.
- Dis à l'utilisateur, en 🔴, quelle session attend, avec son lien, et ce qu'il y a à trancher.
  Ajoute ta recommandation si la réponse découle de ce qu'il a déjà tranché.
- Après coup, si c'était un écran que le brief devait éviter, renvoie-lui le paragraphe « ne
  bloque jamais ».

## 6. Récolter

Chaque camarade tient `/private/tmp/claude-501/anneau-status/<nom>.json`
(`{tache, state, summary, fichiers, updated_at}`). Lis-le avant de conclure quoi que ce soit.
**Regarde `updated_at` d'abord** : antérieur à ton dernier brief ou message à ce camarade, le
fichier ne vaut rien. Fie-toi alors à git et à la note de réveil.

Puis valide contre un signal objectif :
- `git -C <worktree> --no-optional-locks status -sb` et `git -C <worktree> log --oneline @{u}..`
  (le `--no-optional-locks` évite de poser `index.lock` sous ses pieds) ;
- **rien n'a été commité, poussé ni ouvert au-delà de ce que le brief demandait**. Il n'y a plus de
  mod camarade pour refuser un `git push`. Seuls ses règles et ce contrôle le tiennent ;
- l'état de la PR ou de la MR par la CLI, juste avant de le citer.

Deux camarades dont les `fichiers` se recouvrent (même fichier, même catalogue i18n, même chaîne
de migrations) ne tournent pas en parallèle. L'un des deux attend.

Une limite annoncée par un camarade (« seul l'axe X est mesuré ») survit au relais. Garde le
verbe : mesuré ou déduit.

Les commits d'un camarade en worktree restent sur sa branche. Tu ne les fusionnes ici que si
l'utilisateur le dit, en nommant chaque branche par `refs/heads/…`.

## 7. Archiver

`archive_session` arrête la session et **nettoie son worktree par défaut**. L'archivage est
réversible, la perte d'un travail non commité dans le worktree nettoyé ne l'est pas. Une
session lancée avec `cwd` et `use_worktree: false` garde son dossier (mesuré : le dossier et sa
branche étaient intacts après l'archivage).

| Le camarade | Ce que tu fais |
|---|---|
| Sujet fini, travail commité, ou poussé si demandé, ou rien à garder | Archive-le dès la récolte |
| Sujet fini, travail non commité | **N'archive rien.** Fais-le commiter, ou copie au scratchpad d'abord |
| Nouveau sujet à lancer | **Session neuve** ; l'ancienne suit les lignes ci-dessus |
| En cours de tâche | Laisse. Une question en file si besoin |
| Inactif, porteur d'une décision en attente | Récolte la décision, puis archive |
| Lot fini, stack wtm debout | Fais lancer `wtm stop <branche>` par le camarade, pas `remove` |

**Un camarade rend son rapport, puis se ferme : archive-le sans demander** dès que la récolte est
faite et que son travail est en sécurité. Dis-le en une ligne (« frodon archivé, rien à
récupérer » ou « branche poussée »). Ne pose jamais la question à l'utilisateur.

## Les pièges

- **Un camarade « idle » n'est pas un camarade vide.** Il peut tenir un correctif non commité.
- **Vérifie l'arbre où il travaille avant de briefer.** Croise son `cwd` avec `git worktree list`.
  Le checkout principal (première ligne) ne se touche jamais.
- **Le git d'un worktree se confie à celui qui le tient** : commit, rebase, push. Pour un
  camarade archivé, relance une session sur le même dossier.
- **Ne confie pas deux sujets au même camarade.** Seul l'anneau unique en porte plusieurs.
- **Un camarade ne pousse pas et n'annonce pas.** Il rend la branche. Écris-le dans chaque brief.
- **Ce qu'un camarade rend se relit.** Une PR annoncée « non draft, CI verte » peut être en draft,
  donc sans CI.

## Checklist

1. Outils `ccd_session` chargés.
2. Session liée ou sous-agent tranché (§ 0).
3. Tour ouvert par l'utilisateur, sinon carte `own_initiative`.
4. Dossier : `cwd` nommé par l'utilisateur, ou `use_worktree: true` depuis une branche.
5. `start_session` avec le nom, le brief complet (paragraphe « ne bloque jamais » compris),
   `background` et `effort`. Pas de `permission_mode`.
6. Abonnement `notify_when_idle` si tu dois être réveillé par ce camarade précis.
7. Récolte : statut (`updated_at` d'abord), git, rien de poussé hors brief, `fichiers` comparés
   à ceux des autres camarades.
8. Archivage sans demander, dès la récolte faite et le travail en sécurité.
