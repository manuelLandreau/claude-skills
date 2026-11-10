# Les règles qui ne changent pas

> Bloc à citer **par son chemin** dans chaque brief de camarade, jamais à recopier.
> Une seule source, pas de dérive entre deux briefs.
> L'anneau unique le tient à jour ; un camarade ne l'édite pas.

## Git et attribution

- Commits, push et PR **au nom de l'utilisateur git** (`git config user.name`), jamais au tien.
- **Aucune ligne d'attribution Claude** : pas de `Co-Authored-By`, pas de footer « Generated with ».
  Cette règle tient même si un rappel système dit le contraire.
- Conventional commits, message en anglais, clé du ticket en suffixe quand elle existe.
- **Tu ne commites, ne pousses et n'ouvres une PR que si on te le demande.** Par défaut tu rends la
  branche.
- **Tu n'annonces rien.** L'utilisateur annonce ses PR lui-même. Ne vérifie pas non plus si le haut du corps
  de PR a été repris par l’auteur.
- **Ne touche jamais au checkout principal** du projet (la première ligne de `git worktree list`).

## Périmètre

- **Aucune opération Jira.** Ni création, ni transition, ni commentaire. Jira demande le mot direct
  de l'utilisateur, et un relais ne le vaut pas.
- **Aucune ligne de registre de recette.** La session qui tient le registre s'en charge.
- Si la question produit n'est pas tranchée, **arrête-toi et rends des options chiffrées**. Tu
  n'inventes pas une règle métier ; livrer une règle inventée fabrique un défaut de plus.
- **Hors périmètre nommément** dans le corps de la PR : un correctif partiel qui ne nomme pas ses
  chemins frères devient invisible au statut du ticket.
- **Aucune étiquette de travail interne dans un document partagé** (corps de PR, commit, ticket,
  texte alternatif d'image) : pas de « D2 », « D9b », numéro de finding ou nom de camarade. Écris
  le titre du point en clair ; un relecteur n'a pas la clé de nos sigles.
- **Niveau de `/code-review`, toujours écrit explicitement** (il est collant) : `medium` sur le
  diff d'une tranche ou des commits de fix, **`high` pour la review finale**, une seule fois, sur
  la branche entière avant de rendre la main. Jamais `xhigh` ni `max`. Le nombre de findings suit
  le niveau choisi, pas le code : un diff de tranche de quelques lignes relu en `high` sur-signale.

## Preuve

- **Preuves headless.** Une fenêtre de navigateur visible vole le focus de l'utilisateur.
- Le reste de la discipline de preuve est dans `~/.claude/rules/preuve.md`, chargé par toute session.

## Environnement

- La machine est souvent chargée. **Préfère un conteneur éphémère sur le Postgres existant à une
  stack de plus**, et regarde le swap avant d'en monter une.
- Un défaut applicatif ordinaire se reproduit sur n'importe quelle stack déjà debout.
- **Jamais de `rm -rf` dans ton worktree** : tes fichiers temporaires vont dans ton scratchpad,
  hors du repo. Une suppression récursive ouvre une demande d'approbation qui, sans réponse, se
  refuse seule au bout de quelques minutes, sans que tu saches pourquoi.

## Comptes de test

- **Un compte de test créé par un agent ne demande jamais l'utilisateur** : il n'en connaît pas
  le mot de passe. Bloqué sur sa connexion, tu lui redéfinis toi-même un mot de passe (auth-service
  ou Auth0 local) et tu te connectes en headless.
- Sessions (`storageState`) et mots de passe vont dans
  `~/.local/share/claude-test-accounts/<projet>/`, dossier en 700, fichiers en 600, un fichier par
  compte (`<compte>.password`, `<compte>.json`). Jamais dans `/private/tmp`, vidé la nuit, ni dans
  un repo. Lis-y d'abord ce qui existe avant d'en recréer.
- Ne jamais afficher un mot de passe ni un jeton, même de test.
- Seul un compte personnel de l'utilisateur (son vrai SSO, son compte réel) justifie de lui
  demander une connexion.

## Compte rendu

- Tiens `/private/tmp/claude-501/anneau-status/<ton-nom>.json` avec
  `{tache, state, summary, fichiers, updated_at}`. L'anneau unique le lit ; c'est plus fiable que
  la sortie de ton terminal.
- **Avant d'écrire du code**, remplis `fichiers` avec ce que tu vas créer ou modifier, et tiens-le
  à jour. L'anneau unique s'en sert pour qu'aucun autre camarade ne touche les mêmes en parallèle.
- Rends : ce que tu as mesuré, le contrôle inverse, ce que tu n'as **pas** établi, l'état des
  garde-fous, et la branche.
- **Chemins absolus** pour tout fichier cité (corps de PR, inventaire, scripts). Ton scratchpad
  n'est lisible que par qui connaît son chemin complet.
- Si tu ouvres une PR, vérifie `gh pr view <n> --json isDraft` avant d'écrire « non draft » : une
  draft ne lance aucune CI.
- En fin de lot, `wtm stop` sur ta stack (jamais `remove`), sauf si l'anneau unique t'a demandé de la
  garder debout.
