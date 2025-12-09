# DigitalOcean App Platform Deployment Guide

Step-by-step guide to deploy Memory Mesh to DigitalOcean App Platform.

## Prerequisites

1. DigitalOcean account (sign up at https://www.digitalocean.com)
2. GitHub repository pushed (your code should be on GitHub)
3. Credit card for DigitalOcean (they have a free trial)

## Step 1: Prepare Your Repository

Ensure your code is pushed to GitHub:
```bash
git add .
git commit -m "Prepare for DigitalOcean deployment"
git push origin main
```

## Step 2: Create App on DigitalOcean

### Option A: Using App Spec (Recommended)

1. Go to DigitalOcean Dashboard → Apps → Create App
2. Choose "GitHub" as source
3. Select your repository: `shubhhh19/memory-layer`
4. Choose branch: `main`
5. Click "Edit App Spec" and paste the configuration from `.do/app.yaml`
6. Or use "From Source" and configure manually (see Option B)

### Option B: Manual Configuration

1. Go to DigitalOcean Dashboard → Apps → Create App
2. Choose "GitHub" as source
3. Select repository and branch

## Step 3: Configure Backend Service

### Basic Settings:
- **Name**: `api`
- **Source Directory**: `/` (root)
- **Environment**: Python
- **Build Command**: 
  ```bash
  pip install --upgrade pip && pip install uv && uv sync --frozen --no-dev
  ```
- **Run Command**: 
  ```bash
  .venv/bin/uvicorn ai_memory_layer.main:app --host 0.0.0.0 --port 8080
  ```
- **HTTP Port**: `8080`
- **Health Check Path**: `/v1/admin/health`

### Environment Variables:

Add these environment variables in the App Platform UI:

**Required:**
```
MEMORY_ENVIRONMENT=production
MEMORY_DATABASE_URL=${db.DATABASE_URL}
MEMORY_REDIS_URL=${redis.REDIS_URL}
MEMORY_JWT_SECRET_KEY=<generate-secure-key>
MEMORY_ALLOWED_ORIGINS=https://your-frontend-app.ondigitalocean.app
```

**Optional:**
```
MEMORY_SQL_ECHO=false
MEMORY_ENABLE_METRICS=true
MEMORY_ASYNC_EMBEDDINGS=true
MEMORY_GLOBAL_RATE_LIMIT=200/minute
MEMORY_TENANT_RATE_LIMIT=120/minute
MEMORY_GEMINI_API_KEY=<your-gemini-key>
```

**Generate JWT Secret Key:**
```bash
python -c 'import secrets; print(secrets.token_urlsafe(32))'
```

## Step 4: Add PostgreSQL Database

1. In App Platform, click "Add Component" → "Database"
2. Choose **PostgreSQL**
3. Version: **16** (supports pgvector)
4. Name: `db`
5. Plan: Basic ($12/month) or Professional
6. Database name: `memory_layer`
7. Database user: `memory`

**Important**: After database is created, you need to enable pgvector extension:

1. Go to your database in DigitalOcean
2. Click "Connection Details"
3. Connect using `psql` or DigitalOcean Console
4. Run:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## Step 5: Add Redis Database

1. In App Platform, click "Add Component" → "Database"
2. Choose **Redis**
3. Version: **7**
4. Name: `redis`
5. Plan: Basic ($15/month) or Professional

## Step 6: Run Database Migrations

After the app is deployed, run migrations:

### Option A: Using DigitalOcean Console

1. Go to your app → "Console" tab
2. Run:
```bash
alembic upgrade head
```

### Option B: Using doctl CLI

```bash
# Install doctl
brew install doctl  # macOS
# or download from https://github.com/digitalocean/doctl

# Authenticate
doctl auth init

# Get app ID from DigitalOcean dashboard
doctl apps create-deployment <app-id> --force-rebuild
```

### Option C: Add Migration Step to Build

Modify build command to include migrations:
```bash
pip install --upgrade pip && pip install uv && uv sync --frozen --no-dev && alembic upgrade head
```

## Step 7: Configure Frontend Service

1. In App Platform, click "Add Component" → "Service"
2. Choose "GitHub" source
3. Select same repository: `shubhhh19/memory-layer`
4. **Source Directory**: `frontend`
5. **Environment**: Node.js
6. **Build Command**: 
   ```bash
   npm install && npm run build
   ```
7. **Run Command**: 
   ```bash
   npm start
   ```
8. **HTTP Port**: `3000`

### Frontend Environment Variables:

```
NEXT_PUBLIC_API_BASE_URL=https://api-your-app.ondigitalocean.app
NODE_ENV=production
```

**Important**: Replace `api-your-app.ondigitalocean.app` with your actual backend app URL from DigitalOcean.

## Step 8: Update CORS Settings

After frontend is deployed, update backend's `MEMORY_ALLOWED_ORIGINS`:

```
MEMORY_ALLOWED_ORIGINS=https://frontend-your-app.ondigitalocean.app
```

Replace with your actual frontend URL.

## Step 9: Custom Domains (Optional)

### Backend Domain:
1. Go to backend service → Settings → Domains
2. Add custom domain: `api.yourdomain.com`
3. Update DNS records as instructed
4. Update `MEMORY_ALLOWED_ORIGINS` to include new domain

### Frontend Domain:
1. Go to frontend service → Settings → Domains
2. Add custom domain: `yourdomain.com` or `www.yourdomain.com`
3. Update DNS records
4. Update `NEXT_PUBLIC_API_BASE_URL` if using custom backend domain

## Step 10: Deploy

1. Review all settings
2. Click "Create Resources" or "Save"
3. DigitalOcean will build and deploy your app
4. Monitor the build logs for any errors

## Post-Deployment Checklist

- [ ] Backend is accessible and healthy
- [ ] Frontend is accessible
- [ ] Database migrations completed
- [ ] pgvector extension enabled in PostgreSQL
- [ ] Redis is connected
- [ ] CORS configured correctly
- [ ] JWT secret key is set
- [ ] Frontend can connect to backend
- [ ] SSL certificates are active (automatic with DigitalOcean)

## Troubleshooting

### Build Fails

**Error: "uv: command not found"**
- Ensure build command includes: `pip install uv`

**Error: "Module not found"**
- Check that `uv sync --frozen --no-dev` runs successfully
- Verify `pyproject.toml` has all dependencies

### Database Connection Issues

**Error: "Connection refused"**
- Verify `MEMORY_DATABASE_URL` uses `${db.DATABASE_URL}` format
- Check database is created and running
- Verify database name and user are correct

**Error: "Extension vector does not exist"**
- Connect to database and run: `CREATE EXTENSION vector;`

### Frontend Can't Connect to Backend

- Verify `NEXT_PUBLIC_API_BASE_URL` is correct
- Check backend URL is accessible
- Verify CORS includes frontend URL
- Check browser console for errors

### Health Check Fails

- Verify health endpoint: `/v1/admin/health`
- Check app logs in DigitalOcean dashboard
- Ensure database and Redis are connected

## Cost Estimate

**Basic Setup:**
- App Platform (Basic): ~$5/month per service (2 services = $10)
- PostgreSQL (Basic): $12/month
- Redis (Basic): $15/month
- **Total: ~$37/month**

**Professional Setup:**
- App Platform (Professional): ~$12/month per service
- PostgreSQL (Professional): $60/month
- Redis (Professional): $60/month
- **Total: ~$144/month**

## Monitoring

1. **App Logs**: View in DigitalOcean dashboard → App → Runtime Logs
2. **Metrics**: App Platform provides basic metrics
3. **Alerts**: Set up alerts in DigitalOcean dashboard
4. **Custom Monitoring**: Use Prometheus metrics endpoint `/metrics`

## Updating Your App

DigitalOcean automatically redeploys when you push to the connected branch.

To manually trigger deployment:
1. Go to App → Deployments
2. Click "Create Deployment"
3. Or push to your GitHub branch

## Support

- DigitalOcean Docs: https://docs.digitalocean.com/products/app-platform/
- App Platform Community: https://www.digitalocean.com/community/tags/app-platform
- Your App Logs: DigitalOcean Dashboard → Your App → Runtime Logs

