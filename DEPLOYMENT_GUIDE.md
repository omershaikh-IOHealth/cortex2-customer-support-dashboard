# CORTEX 2.0 - Production Deployment Guide

## 🎯 Deployment Checklist

### Pre-Deployment
- [ ] Backend tests passed
- [ ] Frontend builds successfully
- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] SSL certificates ready (for HTTPS)
- [ ] Domain names configured
- [ ] Monitoring tools set up

---

## 🖥️ Backend Deployment

### Option 1: Traditional Server (PM2)

```bash
# Install PM2 globally
npm install -g pm2

# Navigate to backend directory
cd backend

# Install production dependencies
npm install --production

# Start with PM2
pm2 start server.js --name cortex-backend

# Save PM2 configuration
pm2 save

# Setup auto-restart on reboot
pm2 startup
```

**PM2 Commands:**
```bash
pm2 status              # Check status
pm2 logs cortex-backend # View logs
pm2 restart cortex-backend
pm2 stop cortex-backend
pm2 delete cortex-backend
```

### Option 2: Docker

**Create `backend/Dockerfile`:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 5000
CMD ["node", "server.js"]
```

**Build & Run:**
```bash
cd backend
docker build -t cortex-backend .
docker run -d \
  --name cortex-backend \
  -p 5000:5000 \
  --env-file .env \
  --restart unless-stopped \
  cortex-backend
```

### Option 3: Cloud Platform

**Heroku:**
```bash
heroku create cortex-backend
heroku addons:create heroku-postgresql
git push heroku main
```

**DigitalOcean App Platform:**
- Connect GitHub repo
- Auto-deploy on push
- Managed database included

---

## 🌐 Frontend Deployment

### Option 1: Vercel (Recommended for Next.js)

```bash
# Install Vercel CLI
npm install -g vercel

# Navigate to frontend
cd frontend

# Deploy
vercel

# Production deployment
vercel --prod
```

**Environment Variables in Vercel:**
- Go to Project Settings
- Add `NEXT_PUBLIC_API_URL`
- Set to your backend URL

### Option 2: Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Build production
npm run build

# Deploy
netlify deploy --prod
```

### Option 3: Traditional Server (Nginx)

```bash
# Build production bundle
cd frontend
npm run build

# Start production server
npm start
# Or use PM2
pm2 start npm --name "cortex-frontend" -- start
```

**Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🔐 SSL/HTTPS Setup

### Using Let's Encrypt (Certbot)

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo certbot renew --dry-run
```

---

## 🗄️ Database Setup

### Production PostgreSQL

**Option 1: Managed Service**
- AWS RDS
- DigitalOcean Managed Database
- Google Cloud SQL
- Azure Database for PostgreSQL

**Option 2: Self-Hosted**
```bash
# Install PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# Secure configuration
sudo -u postgres psql
ALTER USER postgres PASSWORD 'your_secure_password';
CREATE DATABASE cortex_production;

# Create read-only user for safety
CREATE USER cortex_reader WITH PASSWORD 'reader_password';
GRANT CONNECT ON DATABASE cortex_production TO cortex_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA test TO cortex_reader;
```

---

## 🔒 Security Best Practices

### Environment Variables
**Never commit these files:**
- `.env`
- `.env.local`
- `.env.production`

**Use secrets management:**
- AWS Secrets Manager
- HashiCorp Vault
- Vercel Environment Variables
- Heroku Config Vars

### Database Security
```bash
# Use connection string with SSL
DATABASE_URL=postgres://user:pass@host:5432/db?sslmode=require

# Whitelist IPs only
# Set in database firewall rules
```

### API Security
```javascript
// Add rate limiting (in server.js)
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

---

## 📊 Monitoring & Logging

### Backend Monitoring

**PM2 Monitoring:**
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

**External Services:**
- New Relic
- Datadog
- Sentry (for error tracking)

### Frontend Monitoring
```bash
# Vercel Analytics (built-in)
# Or add Google Analytics
```

### Database Monitoring
- PgHero
- pgAdmin
- Cloud provider dashboards

---

## 🔄 CI/CD Pipeline

### GitHub Actions Example

**`.github/workflows/deploy.yml`:**
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: cd backend && npm ci
      - run: cd backend && npm test
      - name: Deploy to server
        run: |
          # Your deployment script

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: cd frontend && npm ci
      - run: cd frontend && npm run build
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
```

---

## 🧪 Health Checks

### Backend Health Endpoint
Already included: `GET /api/health`

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-02-12T10:30:00.000Z"
}
```

### Monitoring Script
```bash
#!/bin/bash
# health-check.sh

BACKEND_URL="https://api.yourdomain.com/api/health"
FRONTEND_URL="https://yourdomain.com"

# Check backend
if curl -f $BACKEND_URL; then
  echo "Backend: OK"
else
  echo "Backend: FAILED"
  # Send alert
fi

# Check frontend
if curl -f $FRONTEND_URL; then
  echo "Frontend: OK"
else
  echo "Frontend: FAILED"
  # Send alert
fi
```

**Run with cron:**
```bash
# Every 5 minutes
*/5 * * * * /path/to/health-check.sh
```

---

## 📦 Backup Strategy

### Database Backups

```bash
# Daily backup script
#!/bin/bash
pg_dump -h localhost -U cortex_user cortex_production > \
  backup_$(date +%Y%m%d).sql

# Compress
gzip backup_$(date +%Y%m%d).sql

# Upload to S3
aws s3 cp backup_$(date +%Y%m%d).sql.gz \
  s3://your-backup-bucket/

# Keep only last 30 days locally
find . -name "backup_*.sql.gz" -mtime +30 -delete
```

**Automated with cron:**
```bash
# Every day at 2 AM
0 2 * * * /path/to/backup.sh
```

---

## 🚀 Performance Optimization

### Backend
```javascript
// Enable compression
import compression from 'compression';
app.use(compression());

// Add caching headers
app.use((req, res, next) => {
  res.set('Cache-Control', 'public, max-age=300');
  next();
});
```

### Frontend
```javascript
// Already optimized with Next.js:
// - Automatic code splitting
// - Image optimization
// - Static generation where possible
```

### Database
```sql
-- Add indexes for frequently queried fields
CREATE INDEX idx_tickets_sla_status ON test.tickets(sla_status);
CREATE INDEX idx_tickets_priority ON test.tickets(priority);
CREATE INDEX idx_tickets_created_at ON test.tickets(created_at);

-- Vacuum regularly
VACUUM ANALYZE test.tickets;
```

---

## 📝 Environment Variables

### Backend Production (.env)
```bash
NODE_ENV=production
PORT=5000

# Database (use connection string)
DATABASE_URL=postgres://user:password@host:5432/dbname?sslmode=require

# Or individual values
DB_HOST=your-db-host.com
DB_PORT=5432
DB_NAME=cortex_production
DB_USER=cortex_user
DB_PASSWORD=your_secure_password

# SSL enabled
DB_SSL=true
```

### Frontend Production (.env.local)
```bash
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

---

## 🔧 Troubleshooting Production

### Backend Issues
```bash
# Check logs
pm2 logs cortex-backend

# Check process status
pm2 status

# Restart
pm2 restart cortex-backend
```

### Database Connection Issues
```bash
# Test connection
psql -h your-db-host -U cortex_user -d cortex_production

# Check active connections
SELECT count(*) FROM pg_stat_activity;

# Kill stuck connections
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = 'cortex_production';
```

---

## 📊 Scaling Strategy

### Vertical Scaling
- Increase server resources (CPU, RAM)
- Upgrade database tier
- Add read replicas

### Horizontal Scaling
- Load balancer (Nginx, AWS ALB)
- Multiple backend instances
- Database connection pooling
- Redis for caching

---

**Ready for production deployment! 🚀**
