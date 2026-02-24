Docker deployment (keeps SQLite data)
===================================

This project can be run in Docker with a host-mounted `./data` folder so the SQLite `travel.db` file persists across container restarts.

Build image locally:

```bash
docker build -t travel-counter-app .
```

Run with docker:

```bash
# create data dir
mkdir -p data

docker run -d \
  -p 3000:3000 \
  -v "$PWD":/usr/src/app:delegated \
  -v "$PWD"/data:/usr/src/app/data \
  -e SESSION_SECRET="change-this-in-prod" \
  --name travel-app \
  travel-counter-app
```

Or use docker-compose (recommended for development/servers):

```bash
# ensure data dir exists
mkdir -p data

docker-compose up -d --build

# view logs
docker-compose logs -f

# stop
docker-compose down
```

Notes
- The database is initialized automatically by `server.js` which calls `db/schema.js` on startup.
- Change `SESSION_SECRET` in the `docker-compose.yml` or via environment when running in production.
- To create an admin user from your host (after container is running):

```bash
docker exec -it travel-app node scripts/create_user.js --name "Admin" --username admin --password admin123 --role admin
```

- If you prefer running behind a reverse proxy (nginx), bind to localhost only and place nginx in front of the container.
- This approach keeps the app code unchanged and uses SQLite with a host-mounted `./data` folder. For larger scale or managed DBs, migrate to Postgres (see future task).

Reverse proxy and systemd (recommended for VPS)
-----------------------------------------------
A common production setup places nginx in front of the container (proxying to `127.0.0.1:3000`) and runs `docker-compose` under systemd.

Files included under `deploy/`:
- `deploy/nginx.travel.conf` — example nginx site config (change `server_name` and paths).
- `deploy/travel-app.service` — example `systemd` unit which runs `docker-compose up -d --build` from `/opt/travel-counter-app` (edit the path).

Example nginx setup steps (Ubuntu):

```bash
# copy nginx config (adjust domain and paths)
sudo cp deploy/nginx.travel.conf /etc/nginx/sites-available/travel
sudo ln -s /etc/nginx/sites-available/travel /etc/nginx/sites-enabled/travel
sudo mkdir -p /var/www/certbot
sudo nginx -t && sudo systemctl reload nginx
```

Obtain TLS cert (Certbot):

```bash
# install certbot and the nginx plugin (Ubuntu)
sudo apt update && sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.example.com
```

Install systemd unit (edit path first):

```bash
sudo cp deploy/travel-app.service /etc/systemd/system/travel-app.service
sudo systemctl daemon-reload
sudo systemctl enable --now travel-app.service
sudo journalctl -u travel-app -f
```

Healthcheck
-----------
The container exposes a `/health` endpoint and the Docker image includes a `HEALTHCHECK` so orchestration systems can detect unhealthy containers and restart them automatically.

