# Deployment Guide — SalonPro SaaS Platform

## Prerequisites

| Tool | Version |
|------|---------|
| Docker | 24+ |
| Docker Compose | 2.20+ |
| Node.js | 20 LTS |
| Python | 3.12 |
| ODBC Driver for SQL Server | 18 |

---

## 1. Local Development Setup

### Backend

```bash
cd E:\salon-saas\backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac

pip install -r requirements.txt

# Copy and edit environment variables
copy .env.example .env
# Edit .env with your SQL Server and Redis credentials

# Run database migrations
alembic upgrade head

# Seed default data (roles, plans, super-admin)
python -m app.scripts.seed

# Start development server
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd E:\salon-saas\frontend

npm install

# Copy environment file (optional — dev proxies to localhost:8000)
copy .env.example .env.local

npm run dev    # starts on http://localhost:3000
```

---

## 2. Docker Compose (Production-like)

### Create environment file

```bash
cd E:\salon-saas\docker
copy .env.example .env
```

Edit `docker/.env`:

```env
DB_SA_PASSWORD=YourStr0ngP@ssword!
DB_NAME=SalonSaaS
REDIS_PASSWORD=redis_secret_123
SECRET_KEY=change-me-to-64-char-random-string
```

### Build and start all services

```bash
cd E:\salon-saas\docker
docker compose up -d --build
```

Services started:
- **SQL Server** → `localhost:1433`
- **Redis** → `localhost:6379`
- **FastAPI backend** → `localhost:8000`
- **React frontend (Nginx)** → `localhost:80`

### Run initial migrations inside the container

```bash
docker exec salon_backend alembic upgrade head
docker exec salon_backend python -m app.scripts.seed
```

### View logs

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

---

## 3. Environment Variables Reference

### Backend `.env`

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_SERVER` | SQL Server hostname | `localhost` |
| `DB_PORT` | SQL Server port | `1433` |
| `DB_NAME` | Database name | `SalonSaaS` |
| `DB_USER` | DB username | `sa` |
| `DB_PASSWORD` | DB password | `...` |
| `SECRET_KEY` | JWT signing key (64 chars) | `openssl rand -hex 32` |
| `REDIS_HOST` | Redis hostname | `localhost` |
| `REDIS_PASSWORD` | Redis password | `...` |
| `SMTP_HOST` | Email SMTP server | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | `you@gmail.com` |
| `SMTP_PASSWORD` | SMTP app password | `...` |
| `TWILIO_ACCOUNT_SID` | Twilio SID | `AC...` |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | `...` |
| `TWILIO_FROM_NUMBER` | Twilio phone number | `+1...` |
| `LOYALTY_POINTS_PER_CURRENCY` | Points earned per ₹1 | `1` |
| `LOYALTY_POINTS_REDEMPTION_RATE` | ₹ value per point | `0.01` |
| `SUPER_ADMIN_EMAIL` | Super admin login | `admin@salonpro.com` |
| `SUPER_ADMIN_PASSWORD` | Super admin password | `...` |

---

## 4. Database Migrations (Alembic)

```bash
cd backend

# Create a new migration after model changes
alembic revision --autogenerate -m "add_column_xyz"

# Apply all pending migrations
alembic upgrade head

# Roll back one migration
alembic downgrade -1

# Show current revision
alembic current

# Show migration history
alembic history --verbose
```

---

## 5. Production Deployment (VPS / Cloud VM)

### Recommended spec
- 2 vCPU, 4 GB RAM minimum
- 50 GB SSD
- Ubuntu 22.04 LTS

### Steps

```bash
# 1. Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 2. Clone / upload project
git clone <your-repo> /opt/salon-saas
cd /opt/salon-saas/docker

# 3. Configure environment
cp .env.example .env
nano .env   # fill in all secrets

# 4. Start services
docker compose up -d --build

# 5. Run migrations
docker exec salon_backend alembic upgrade head
docker exec salon_backend python -m app.scripts.seed

# 6. Set up SSL with Certbot (optional but recommended)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

### Nginx SSL (update nginx.conf)

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    # ... rest of config
}
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}
```

---

## 6. Health Checks

| Endpoint | Expected |
|----------|----------|
| `GET /health` | `{"status": "ok", ...}` |
| `GET /api/v1/health` | backend connectivity |
| Redis PING | `PONG` |

```bash
curl http://localhost:8000/health
```

---

## 7. Backup

```bash
# SQL Server backup
docker exec salon_db /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "$DB_SA_PASSWORD" \
  -Q "BACKUP DATABASE SalonSaaS TO DISK='/var/opt/mssql/backup/SalonSaaS_$(date +%Y%m%d).bak'"

# Redis backup (RDB snapshot)
docker exec salon_redis redis-cli -a "$REDIS_PASSWORD" BGSAVE
```

---

## 8. Scaling

For high traffic, run multiple backend workers behind a load balancer:

```yaml
# docker-compose.prod.yml override
backend:
  deploy:
    replicas: 3
  command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

Add an Nginx upstream block to load-balance across replicas.
