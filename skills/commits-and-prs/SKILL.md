---
name: commits-and-prs
description: Use when committing on a branch, rebasing it, opening or editing a pull request, answering review feedback, or checking a branch before merge. Covers atomic commits kept clean by local rebase (whatever the remote merge strategy), non-interactive fixup/autosquash, the "En bref" / "Détails techniques" PR body whose "En bref" a human writes, per-PR screenshot folders, and review fix-ups without force-push.
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

**Corps court.** Un paragraphe, deux au plus, 150 mots plafond, rien quand le diff parle seul. Au-delà : soit le commit n'est pas atomique, soit c'est du contenu de « Détails techniques ».

**Une raison par commit, pas une par ligne.** À écrire : la contrainte non devinable, le piège qu'un lecteur défera par mégarde, l'alternative évidente qui ne marche pas. À ne pas écrire : le diff raconté fichier par fichier, les tests expliqués, ce que le code dit déjà.

**L'agent attend un accord explicite avant `git commit`**, et avant tout push. Invoquer une skill qui livre (`full-implem`) vaut cet accord. Branche déjà poussée et réécrite avant review : `git push --force-with-lease`, jamais `--force`.

## Pull requests

### Titre

Suivre la forme des PR mergées récemment (`gh pr list --state merged -L 10 --json title`). À défaut : préfixe conventionnel, description courte, clé de ticket en fin de titre si la branche en porte une (motif `[A-Z][A-Z0-9]+-[0-9]+`).

### Corps

Deux sections, dans cet ordre, rien d'autre.

`## En bref` décrit la PR. Obligatoire, concise, **écrite par un humain**. À la création, l'agent publie le titre de section et laisse le contenu vide ; l'auteur le rédige en éditant la PR.

**Toute édition ultérieure repart du corps publié** (`gh pr view <n> --json body`) et recopie « En bref » et les captures verbatim, section vide comprise : GitHub remplace le champ entier à chaque écriture, republier le gabarit efface ce que l'auteur y a mis.

`## Détails techniques` est facultative et libre : fonctionnement fin, points d'attention pour le relecteur, hors-périmètre, choix écartés, vérification faite, liens ticket/maquette. L'agent peut la rédiger.

**PR qui touche le front → sous-section `### Captures`** dans « Détails techniques » : avant / après pour un écran modifié, capture simple pour un écran nouveau.

Un agent ne peut pas téléverser d'image sur GitHub. Il produit les captures pendant sa preuve runtime (skill `runtime-proof`), les range dans **un dossier par PR** — le nom de branche privé de son préfixe : `~/Desktop/ABC-123-some-feature/` pour `feat/ABC-123-some-feature` — nommées `<clé>-avant.png` / `<clé>-apres.png`, et laisse un emplacement commenté par capture. L'auteur glisse les images au même passage que « En bref ». Jamais en vrac sur le Bureau : un ticket peut livrer plusieurs PR.

**Chaque capture est relue (`Read`) avant d'être annoncée** : un snapshot d'accessibilité lit le DOM, pas la mise en page, donc débordements et superpositions passent le snapshot.

Corps à la création :

```markdown
## En bref

## Détails techniques

<contenu, ou section retirée si elle n'a rien à dire>

### Captures

<!-- ABC-123-avant.png -->
<!-- ABC-123-apres.png -->
```

### Retours de review

Une fois la PR relue, chaque correction est un **commit correctif par-dessus**, sans amend, sans rebase, **sans force-push** : le relecteur doit pouvoir lire le diff de ce qu'il a demandé sans relire la branche. Seule dérogation à l'atomicité, assumée.

Sujet conventionnel qui dit ce qui est corrigé (`fix: reject an empty catchment area`), jamais « review feedback ».

## Avant de proposer la PR

1. Rejouer les garde-fous CI sur le dernier commit, ciblés sur le diff : skill `ci-parity` (ou celle du repo).
2. `git log --oneline <base>..HEAD` : aucun commit n'en corrige un autre, chacun est atomique. Sinon résorber (fixup + autosquash) **avant** de créer la PR.
3. Branche rebasée sur la base à jour (`git fetch` puis `git rebase origin/<base>`).
