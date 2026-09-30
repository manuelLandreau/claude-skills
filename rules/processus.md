# Arrêter un process

- Tu n'arrêtes que les process que tu as lancés, par le PID relevé au lancement (`$!` ou `run_in_background`).
- Jamais `lsof … | xargs kill`, `pkill`, `killall`. `lsof -ti -iTCP:<port>` lit `-i` sans argument et sélectionne toutes les sockets en écoute : ça a déjà tué OrbStack, toute la stack Docker et le serveur de dev de l'utilisateur.
- Sans PID relevé, laisse tourner et dis-le.
