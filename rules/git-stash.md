# git stash

- Jamais de `git stash` / `git stash pop` nus : la pile est partagée entre tous les worktrees d'un repo, un `pop` peut restaurer le travail d'une autre session.
- Pour remiser : `git stash push -u -m "<tag-unique>"`, relève le SHA, restaure par `git stash apply <sha>`.
