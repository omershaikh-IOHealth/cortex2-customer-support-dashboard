# Cortex 2.0 — Deployment Guide

Cortex 2.0 is a **unified Next.js 14 application** — there is no separate backend server. The API routes live inside the Next.js app at `app/api/**`. You deploy one process.

---

## Pre-deployment checklist

- [ ] All required environment variables configured (see below)
- [ ] Database is reachable from the deployment host
- [ ] `npm run build` completes without errors
- [ ] `/api/setup` migration has been run once against the target database
- [ ] `AUTH_SECRET` is a strong random value (not the default)
- [ ] `.env.local` is **never committed to git** (it is in `.gitignore`)

---

## Environment variables

All configuration lives in a single `.env.local` file at the repo root (or in your deployment platform's secret manager).

```env
# ── Database ──────────────────────────────────────────────
DB_HOST=                  # PostgreSQL host
DB_PORT=5432
DB_NAME=                  # Database name
DB_USER=                  # DB user
DB_PASSWORD=              # DB password

# ── Auth ──────────────────────────────────────────────────
AUTH_SECRET=              # Long random string — generate: openssl rand -base64 32
# Optional: override the detected base URL (needed behind reverse proxies)
# NEXTAUTH_URL=https://your-domain.com

# ── AI Companion ──────────────────────────────────────────
CORE42_API_KEY=

# ── ClickUp ───────────────────────────────────────────────
CLICKUP_API_TOKEN=        # Personal API token (pk_...) from ClickUp Settings → Apps
CLICKUP_LIST_ID=          # The ClickUp list ID to sync tickets into

# ── Optional ──────────────────────────────────────────────
N8N_WEBHOOK_URL=          # Enables "Force Sync Now" button in Admin
```

---

## Option 1: PM2 on a Linux server (recommended for on-prem)

```bash
# Install PM2 globally
npm install -g pm2

# Clone and install
git clone <repo-url> cortex-dashboard
cd cortex-dashboard
npm install

# Create .env.local with production values
nano .env.local

# Build
npm run build

# Start with PM2
pm2 start npm --name "cortex" -- start

# Persist across reboots
pm2 save
pm2 startup
```

**Useful PM2 commands:**

```bash
pm2 status               # Check running processes
pm2 logs cortex          # Tail application logs
pm2 restart cortex       # Restart
pm2 stop cortex          # Stop
```

---

## Option 2: Docker

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build
docker build -t cortex-dashboard .

# Run (pass env vars from file)
docker run -d \
  --name cortex \
  -p 3000:3000 \
  --env-file .env.local \
  --restart unless-stopped \
  cortex-dashboard
```

---

## Option 3: Vercel

1. Connect the GitHub repo to a new Vercel project
2. In Vercel project settings → **Environment Variables**, add all keys from the env section above
3. Vercel auto-detects Next.js and runs `npm run build` on every push to `main`
4. Set `NEXTAUTH_URL` to your Vercel deployment URL

> Note: Vercel serverless functions have a 10-second timeout by default. The app uses `connectionTimeoutMillis: 30000` on the DB pool — on Vercel you may need to reduce this or use a connection pooler (e.g. PgBouncer / Supabase).

---

## Nginx reverse proxy (if self-hosting)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Redirect to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

SSL with Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Database

The app connects to an existing PostgreSQL instance. No migration framework is used — schema is applied once via the setup endpoint.

**Run migrations (once per new database):**

```
GET https://your-domain.com/api/setup?key=<AUTH_SECRET>
```

Expected response: `{"ok":true,"migrations":[...]}`

**Database indexes (recommended for production):**

```sql
CREATE INDEX IF NOT EXISTS idx_tickets_company_deleted
  ON test.tickets(company_id, is_deleted);

CREATE INDEX IF NOT EXISTS idx_tickets_sla_status
  ON test.tickets(sla_status);

CREATE INDEX IF NOT EXISTS idx_tickets_priority
  ON test.tickets(priority);

CREATE INDEX IF NOT EXISTS idx_threads_ticket_id
  ON test.threads(ticket_id);

CREATE INDEX IF NOT EXISTS idx_sla_alerts_ticket_id
  ON test.sla_alerts(ticket_id);
```

---

## Health check

The app exposes a lightweight health endpoint:

```
GET /api/health
```

Response:

```json
{
  "status": "healthy",
  "db": "connected",
  "timestamp": "2026-02-27T10:00:00.000Z"
}
```

Use this for uptime monitoring and load-balancer health probes.

---

## Updating / redeploying

```bash
git pull origin main
npm install          # in case dependencies changed
npm run build
pm2 restart cortex
```

---

## Backup

```bash
# Daily DB backup (add to cron)
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME | gzip > backup_$(date +%Y%m%d).sql.gz

# Cron example — 2 AM daily
0 2 * * * /path/to/backup.sh
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Application error` on first load | Missing env var | Check all required vars are set |
| DB connection timeout | VPN / firewall | Confirm host is reachable from deployment server |
| Auth loop (redirecting to /login) | Wrong `NEXTAUTH_URL` | Set `NEXTAUTH_URL=https://your-domain.com` |
| ClickUp push fails with 401 | Wrong token type | Use Personal API Token (`pk_...`), not OAuth token |
| ZIWO widget stuck connecting | No ZIWO credentials on user | Set `ziwo_email` + `ziwo_password` in Admin → Users |
| Build fails | Type/lint error | Run `npm run lint` locally first |
