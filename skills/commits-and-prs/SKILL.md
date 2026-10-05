---
name: commits-and-prs
description: Use when committing on a branch, rebasing it, opening or editing a pull request, answering review feedback, or checking a branch before merge. Covers atomic commits kept clean by local rebase (whatever the remote merge strategy), non-interactive fixup/autosquash, the PR body ("Ce que change cette PR pour l'utilisateur" / "Comment tester" / "TL;DR", top two kept verbatim on later edits), per-PR screenshot folders, and review fix-ups without force-push.
---

# Commits et pull requests

**Si le repo a sa propre skill de commits/PR, ou un `.github/pull_request_template.md`, c'est elle qui fait foi.** Cette skill est le défaut quand le projet ne dit rien.

L'historique local d'une branche se tient propre **quelle que soit la stratégie de merge du remote** : même quand la forge squashe, la branche est relue commit par commit en review, et c'est elle qui sert au bisect tant qu'elle vit. On rebase, on ne merge pas la base dans la branche.

## Commits

Trois obligations :

- **atomique** : une fonctionnalité ou un fix isolé, rien d'autre ;
- **pleinement fonctionnel** : lint et build verts sur ce commit pris seul ;
- **motivé** : le corps dit le pourquoi que le diff ne montre pas, et s'arrête là.

Au quotidien :

**Ne committer qu'une unité complète.** Pas de point de sauvegarde en plein refactor, pas de « wip ». Si ce n'est pas lisible par quelqu'un d'autre, ce n'est pas committable.

**Aucun commit ne répare un commit de la même branche** (avant la première review). Le dernier : `git commit --amend`. Un plus ancien : fixup + autosquash, sans éditeur interactif :

```bash
git commit --fixup=<sha>
GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash <base>
```

`GIT_SEQUENCE_EDITOR=:` accepte la todo-list générée telle quelle : c'est ce qui rend `rebase -i` utilisable sans terminal interactif.

**Rester à jour avec la base : `git rebase <base>`**, jamais `git merge <base>` dans la branche. `<base>` = la base de la PR si elle existe (`gh pr view --json baseRefName`), sinon `develop` s'il existe, sinon la branche par défaut (`gh repo view --json defaultBranchRef`). Conflit de migrations ou de fichiers générés : régénérer plutôt que résoudre à la main.

**Message en anglais, conventional commits.** Sujet à l'impératif, `feat:` / `fix:` / `chore:` / `docs:` / `refactor:` / `test:`, scope optionnel si le repo en utilise (`git log --oneline -20` pour le voir).

**Corps court.** Un paragraphe, deux au plus, 150 mots plafond, rien quand le diff parle seul. Au-delà : soit le commit n'est pas atomique, soit c’est du contenu de « TL;DR ».

**Une raison par commit, pas une par ligne.** À écrire : la contrainte non devinable, le piège qu'un lecteur défera par mégarde, l'alternative évidente qui ne marche pas. À ne pas écrire : le diff raconté fichier par fichier, les tests expliqués, ce que le code dit déjà.

**L'agent attend un accord explicite avant `git commit`**, et avant tout push. Invoquer une skill qui livre (`full-implem`) vaut cet accord. Branche déjà poussée et réécrite avant review : `git push --force-with-lease`, jamais `--force`.

## Pull requests

### Titre

Suivre la forme des PR mergées récemment (`gh pr list --state merged -L 10 --json title`). À défaut : préfixe conventionnel, description courte, clé de ticket en fin de titre si la branche en porte une (motif `[A-Z][A-Z0-9]+-[0-9]+`).

### Corps

Trois sections, dans cet ordre, rien d'autre.

`## Ce que change cette PR pour l'utilisateur` : deux à quatre lignes, sans jargon, du point de vue de qui utilise l'écran ou l'API. Pas de nom de fichier, de classe ni de migration.

`## Comment tester` : le parcours le plus court pour voir le changement, à suivre sans connaître le code. URL directe, compte à utiliser, puis trois à cinq étapes et le résultat attendu. Une donnée à créer avant passe par une commande prête à coller, pas par « crée-toi un enregistrement ».

L'agent **rédige ces deux sections à la création**, puis l'auteur les reprend à sa main. **Toute édition ultérieure repart du corps publié** (`gh pr view <n> --json body`) et recopie ces deux sections et les captures verbatim : GitHub remplace le champ entier à chaque écriture, et republier le gabarit effacerait ce que l'auteur y a corrigé.

`## TL;DR` : technique et libre (fonctionnement fin, points d'attention pour le relecteur, hors-périmètre, choix écartés, vérification faite, liens ticket/maquette). L'agent la rédige et la met à jour. Retirée si elle n'a rien à dire.

**PR qui touche le front → sous-section `### Captures`** dans « Ce que change cette PR pour l'utilisateur » : avant / après pour un écran modifié, capture simple pour un écran nouveau.

L'agent produit les captures pendant sa preuve runtime (skill `runtime-proof`), les range dans **un dossier par PR** — le nom de branche privé de son préfixe : `~/Desktop/ABC-123-some-feature/` pour `feat/ABC-123-some-feature` — nommées `<clé>-avant.png` / `<clé>-apres.png`. Jamais en vrac sur le Bureau : un ticket peut livrer plusieurs PR.

**L'agent insère lui-même les captures dans la PR** avec `gh` ≥ 2.101 : le corps référence chaque fichier local par `![légende](<chemin>)`, et `gh pr create|edit --body-file <corps.md> --attach '<chemin>#<légende>'` téléverse l'image et réécrit la référence vers `https://github.com/user-attachments/assets/…` (la même chaîne de chemin des deux côtés, 50 fichiers au plus par commande). Relire ensuite le corps publié : plus aucun chemin local ne doit y rester. Pas de navigateur ni de session GitHub à récupérer : le mode auto refuse d'écrire des cookies de session sur disque. Sur une `gh` plus ancienne (`gh help pr edit` sans `--attach`), laisser un emplacement commenté par capture et le dire.

**Chaque capture est relue (`Read`) avant d'être annoncée** : un snapshot d'accessibilité lit le DOM, pas la mise en page, donc débordements et superpositions passent le snapshot.

Corps à la création :

```markdown
## Ce que change cette PR pour l'utilisateur

<deux à quatre lignes>

### Captures

![Avant](/Users/…/Desktop/ABC-123-some-feature/ABC-123-avant.png)
![Après](/Users/…/Desktop/ABC-123-some-feature/ABC-123-apres.png)

## Comment tester

<URL, compte, étapes, résultat attendu>

## TL;DR

<contenu technique, ou section retirée>
```

(chemins réécrits en URL `user-attachments` par `--attach`)

### Retours de review

Une fois la PR relue, chaque correction est un **commit correctif par-dessus**, sans amend, sans rebase, **sans force-push** : le relecteur doit pouvoir lire le diff de ce qu'il a demandé sans relire la branche. Seule dérogation à l'atomicité, assumée.

Sujet conventionnel qui dit ce qui est corrigé (`fix: reject an empty catchment area`), jamais « review feedback ».

**Aucune réponse sur le thread** d'un retour corrigé : le commit correctif répond. Résoudre le thread sans commenter, sauf demande contraire.

### Review postée au nom de l'utilisateur

Une review GitHub (pending puis soumise), un commentaire par point, **ancré sur sa ligne**. Première personne, une ou deux phrases, sans titre, gras ni liste : ça doit se lire comme écrit par l'utilisateur. Ne garder que ce qui touche la conformité au ticket ou un vrai défaut, pas les préférences.

## Avant de proposer la PR

1. Rejouer les garde-fous CI sur le dernier commit, ciblés sur le diff : skill `ci-parity` (ou celle du repo).
2. `git log --oneline <base>..HEAD` : aucun commit n'en corrige un autre, chacun est atomique. Sinon résorber (fixup + autosquash) **avant** de créer la PR.
3. Branche rebasée sur la base à jour (`git fetch` puis `git rebase origin/<base>`).
