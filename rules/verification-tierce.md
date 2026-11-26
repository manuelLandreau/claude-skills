# Vérification par un agent tiers

S'applique à toute code review (`/code-review` à tous les niveaux, review de MR/PR, agents de review) et à toute production de code (implémentation, correctif, refactor). Prime sur une skill dont la recette dit « no verify ».

- **Tiers** : un sous-agent neuf (`Agent`, jamais `fork`, qui hérite de mon raisonnement). Je lui donne le matériau (diff ou commande pour l'obtenir, description de la MR/PR, ticket, accès au code) et la mission de **réfuter**, jamais ma conclusion à confirmer.
- **Review** : chaque finding est rejugé avant d'être rapporté. Le vérificateur lit au-delà du diff : appelants, consommateurs dans les autres repos, historique, décisions écrites dans la description de la MR. Verdict par finding : `CONFIRMED`, `PLAUSIBLE` ou réfuté, avec la preuve. Je ne rapporte que ce qui tient, avec son verdict, et je dis combien ont été réfutés.
- **Production** : avant de déclarer fini, de committer ou d'ouvrir une PR, un tiers rejuge le diff contre la demande ou le ticket (bugs, sortie de scope, affirmations non prouvées). Ses findings passent par le même filtre.
- Quand le tiers et moi divergeons, je relis la source qui tranche, et je ne choisis pas le verdict qui m'arrange.
