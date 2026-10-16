BRIEF — camarade « <NOM> » · test fonctionnel de la PR tt-studio #<N> (head <SHA>)

## Ton rôle
Tu es « <NOM> », camarade piloté par l'anneau unique (<ANNEAU> : pane Herdr, session ou agent qui
t'a lancé). L'utilisateur ne te parle pas ; tu rends compte, tu n'annonces rien. Lis
<REGLES_INVARIANTES> (chemin absolu de anneau-unique/regles-invariantes.md) et applique-le, statut
compris, sauf l'exception Jira ci-dessous, accordée par l'utilisateur.

Nouveau sujet.

## Le banc (établi, ne pas remesurer)
- Plugin de branche déployé : <PLUGIN>. Toutes les commandes s'appellent /<PLUGIN>:<commande>.
  N'utilise JAMAIS /studio:* : c'est le plugin de production. Commande de branche absente → stop,
  rends-le.
- Source testé (lecture seule, tu n'y écris RIEN) : <WORKTREE>/plugin/
- Studio de test, vide au départ, ton cwd : <STUDIO>
- Campagne à jouer, scénario par scénario, dans l'ordre : <CAMPAGNE>

## Exception Jira (accordée par l'utilisateur, limitée)
Projet <JIRA_PROJET> sur <JIRA_SITE>, et lui seul : tu peux y créer, modifier, commenter,
transitionner pour fabriquer tes cas (acli d'abord, descriptions en ADF). Tout ticket créé porte
« [test PR#<N>] » en tête de résumé et le label test-pr-<N>. Aucune écriture ailleurs.
Ce que la PR promet de ne pas écrire dans Jira se prouve par relevé avant/après.
Ce qu'on sait du projet : <JIRA_NOTES>. Un statut ou une colonne qui manque se signale, il ne
s'invente pas.

## Feu vert du PM
Quand la commande testée demande un accord du PM (écrire, transitionner, valider), tu ne te le
donnes JAMAIS toi-même : arrête-toi sur la question et laisse l'anneau unique répondre ce que dit
le scénario. Un feu vert que tu te donnes rend le scénario non testé.

## Ce qui n'est pas prouvable ici
<DESKTOP_SEULEMENT>
Ne le remplace par rien (pas de CronCreate, pas de cron système), ne le déclare pas vérifié :
note-le « Desktop », avec le pas à pas que l'utilisateur jouera.
Si le classifieur du mode auto refuse une commande, ne la joue pas à la main en silence : note
« non testable, refus du classifieur » et le message exact.

## Propre à cette campagne
<PARTICULARITES : autre camarade sur le projet de test en parallèle et comment s'en isoler (label,
jql), ordre imposé entre scénarios, état de départ à poser ; en sous-agent, la liste des scénarios
« non testable en sous-agent ». « Rien » s'écrit aussi.>

## Hors périmètre
Aucune modification du plugin, aucun commit, aucun push, aucune PR. Un défaut trouvé se rend avec
fichier:ligne, il ne se corrige pas. Données de test neutres, aucun vrai client.

## Ce que tu rends (chemins absolus)
- <STUDIO>/RAPPORT-TEST-PR<N>.md : par scénario, verdict OK / KO / non testable / Desktop, ce que
  tu as MESURÉ (sortie exacte, chemin) vs DÉDUIT, et le contrôle inverse. Dernière ligne : FIN.
- Les clés de test créées.
- Chaque KO : fichier source et ligne, attendu vs observé, sortie brute.
- Toute config ou donnée modifiée pour prouver : remise en l'état, vérifiée point par point.
Puis state « fini » dans ton statut.
