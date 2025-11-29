# Production Deployment Guide

## 🎯 Overview

This guide covers deploying the AI Memory Layer to production, including remaining tasks, testing procedures, and operational considerations.

## ✅ What's Already Done

### Core Features
- ✅ Message storage with embeddings
- ✅ Semantic search with pgvector (`ORDER BY embedding <-> :query`) plus in-process fallback
- ✅ Importance scoring algorithm
- ✅ Retention policies (archive/delete) with scheduler defaulting to daily (`*` tenants)
- ✅ Google Gemini embedding integration
- ✅ Rate limiting (global + per-tenant) backed by Redis
- ✅ Redis-backed caching for embeddings/search with invalidation
- ✅ Background embedding job queue with standalone worker
- ✅ CORS configuration
- ✅ API key authentication
- ✅ Health checks & Prometheus metrics (request/search/embedding jobs)
- ✅ Database migrations (Alembic + perf indexes)
- ✅ Comprehensive test suite (all passing in repo)

### Infrastructure
- ✅ Docker & Docker Compose with Postgres+pgvector, Redis, API, worker
- ✅ FastAPI application
- ✅ SQLAlchemy async ORM
- ✅ Structured logging (structlog)
- ✅ Error handling and request timeouts
- ✅ Non-root container image with pinned lockfile (uv.lock)

## 🧭 Production Defaults & Safety Nets
1. **Redis required in production**: set `MEMORY_REDIS_URL` (shared cache + rate limiter).
2. **Async embeddings**: run `aiml-worker` alongside the API when `MEMORY_ASYNC_EMBEDDINGS=true`.
3. **Retention**: defaults to daily (`MEMORY_RETENTION_SCHEDULE_SECONDS=86400`) and runs for all tenants found when `MEMORY_RETENTION_TENANTS=*`.
4. **Readiness vs liveness**: `/v1/admin/health` is lightweight DB ping; `/v1/admin/readiness` optionally exercises the embedding provider.
5. **Search**: Postgres/pgvector is the default path; SQLite remains for local/dev tests only.
6. **Embedding dimensions**: the `messages.embedding` column now accepts any dimension—keep `MEMORY_EMBEDDING_DIMENSIONS` aligned with your provider (e.g. 768 for Gemini).

## 🧪 Testing for Production

### 1. Unit Tests
```bash
# Run all unit tests
pytest tests/unit/ -v

# Expected: All passing
```

### 2. Integration Tests
```bash
# Run integration tests
pytest tests/integration/ -v

# Current Status: All passing (sqlite + mock embeddings)
```

### 3. End-to-End Tests
```bash
# Run E2E tests
pytest tests/e2e/ -v

# Expected: All passing
```

### 4. Manual API Testing

**Start the server:**
```bash
uvicorn ai_memory_layer.main:app --reload
```

**Test sequence:**
```bash
# 1. Health check
curl http://localhost:8000/v1/admin/health

# 2. Store message
curl -X POST http://localhost:8000/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "test",
    "conversation_id": "conv-1",
    "role": "user",
    "content": "I love Python programming"
  }'
# Inline embeddings return 200; async embeddings return 202.

# 3. Search
curl "http://localhost:8000/v1/memory/search?tenant_id=test&query=Python&top_k=5"

# 4. Check metrics
curl http://localhost:8000/metrics
```

### 5. Load Testing

```bash
# Install Apache Bench
brew install httpd  # macOS

# Test message creation (100 requests, 10 concurrent)
ab -n 100 -c 10 \
   -p message.json \
   -T application/json \
   http://localhost:8000/v1/messages

# Create message.json:
echo '{"tenant_id":"load-test","conversation_id":"c1","role":"user","content":"test"}' > message.json
```

## 🚀 Deployment Steps

### Prerequisites
1. **Get Google Gemini API Key**
   - Visit: https://makersuite.google.com/app/apikey
   - Create new API key (free tier: 60 requests/minute)
   - Save for environment configuration

2. **Provision PostgreSQL Database**
   - Managed service (AWS RDS, Google Cloud SQL, etc.)
   - Enable pgvector extension:
     ```sql
     CREATE EXTENSION IF NOT EXISTS vector;
     ```

### Option 1: Docker Deployment

```bash
# 1. Build image
docker build -t ai-memory-layer:latest .

# 2. Create .env file
cat > .env << EOF
MEMORY_DATABASE_URL=postgresql+asyncpg://user:pass@db-host:5432/memory_layer
MEMORY_EMBEDDING_PROVIDER=google_gemini
MEMORY_GEMINI_API_KEY=your-key-here
MEMORY_API_KEYS=prod-key-1,prod-key-2
MEMORY_ALLOWED_ORIGINS=https://yourdomain.com
MEMORY_ENVIRONMENT=production
EOF

# 3. Run migrations
docker run --env-file .env ai-memory-layer:latest alembic upgrade head

# 4. Start container
docker run -d \
  --name memory-layer \
  --env-file .env \
  -p 8000:8000 \
  ai-memory-layer:latest
```

### Option 2: Kubernetes Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-memory-layer
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ai-memory-layer
  template:
    metadata:
      labels:
        app: ai-memory-layer
    spec:
      containers:
      - name: api
        image: ai-memory-layer:latest
        ports:
        - containerPort: 8000
        env:
        - name: MEMORY_DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: memory-layer-secrets
              key: database-url
        - name: MEMORY_GEMINI_API_KEY
          valueFrom:
            secretKeyRef:
              name: memory-layer-secrets
              key: gemini-api-key
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
```

### Option 3: Cloud Platform (Heroku, Railway, etc.)

```bash
# Example: Railway
railway init
railway add
railway up

# Set environment variables in Railway dashboard
```

## 🔧 Production Configuration

### Environment Variables

```bash
# Database
MEMORY_DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db
MEMORY_DATABASE_POOL_SIZE=20
MEMORY_DATABASE_MAX_OVERFLOW=10

# Embeddings
MEMORY_EMBEDDING_PROVIDER=google_gemini
MEMORY_GEMINI_API_KEY=your-key
MEMORY_EMBEDDING_DIMENSIONS=768

# Security
MEMORY_API_KEYS=key1,key2,key3
MEMORY_ALLOWED_ORIGINS=https://app.com,https://admin.app.com

# Performance
MEMORY_GLOBAL_RATE_LIMIT=200/minute
MEMORY_REQUEST_TIMEOUT_SECONDS=30

# Retention
MEMORY_RETENTION_MAX_AGE_DAYS=30
MEMORY_RETENTION_IMPORTANCE_THRESHOLD=0.35
MEMORY_RETENTION_SCHEDULE_SECONDS=86400  # Run daily

# Monitoring
MEMORY_ENVIRONMENT=production
MEMORY_LOG_LEVEL=INFO
MEMORY_METRICS_ENABLED=true
```

## 📊 Monitoring

### Key Metrics to Track

1. **Request Metrics**
   - `http_requests_total` - Total requests by endpoint
   - `http_request_duration_seconds` - Latency histogram
   - `http_requests_in_flight` - Concurrent requests

2. **Business Metrics**
   - `messages_created_total` - Messages stored
   - `memory_searches_total` - Search requests
   - `embedding_generation_duration_seconds` - Embedding time

3. **System Metrics**
   - Database connection pool usage
   - Memory usage
   - CPU usage

### Grafana Dashboard Example

```json
{
  "dashboard": {
    "title": "AI Memory Layer",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])"
          }
        ]
      },
      {
        "title": "P95 Latency",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, http_request_duration_seconds_bucket)"
          }
        ]
      }
    ]
  }
}
```

## 🔍 Troubleshooting

### Common Issues

1. **Embedding Generation Slow**
   - **Symptom**: Requests taking >5 seconds
   - **Solution**: Implement background job queue

2. **Rate Limit Not Working**
   - **Symptom**: Can send unlimited requests
   - **Solution**: Fix SlowAPI integration or use alternative

3. **Database Connection Errors**
   - **Symptom**: "too many connections"
   - **Solution**: Adjust `MEMORY_DATABASE_POOL_SIZE`

4. **Out of Memory**
   - **Symptom**: Container crashes
   - **Solution**: Increase memory limit, optimize embedding caching

## 📋 Pre-Deployment Checklist

- [ ] All environment variables set
- [ ] Database migrations run (`alembic upgrade head`)
- [ ] Google Gemini API key configured and tested
- [ ] API keys generated for authentication
- [ ] CORS origins configured for your domain
- [ ] Health check endpoint accessible
- [ ] Metrics endpoint accessible
- [ ] Load testing completed
- [ ] Monitoring/alerting configured
- [ ] Backup strategy in place
- [ ] Rollback plan documented

## 🎯 Production Readiness Score

**Current: Ready (code + artifacts)**

- ✅ Core Features: 100%
- ✅ Infrastructure: Docker/Compose with Postgres+pgvector, Redis, API, worker
- ✅ Testing: All repo tests passing (sqlite/mock). Run against Postgres/pgvector in CI before go-live.
- ✅ Performance: Background embeddings + Redis cache/rate limit + pgvector search
- ✅ Monitoring: Prometheus metrics + Grafana/alert examples in `docs/monitoring/`
- ▶️ Next validation: Load test with Redis/pgvector + real embedder, and verify dashboards/alerts

## 📞 Support

For issues or questions:
1. Check logs: `docker logs memory-layer`
2. Review metrics: `curl http://localhost:8000/metrics`
3. Check health: `curl http://localhost:8000/v1/admin/health`

## 🔄 Maintenance

### Daily
- Monitor error rates
- Check embedding generation times
- Review retention job logs

### Weekly
- Review slow queries
- Check database size growth
- Analyze usage patterns

### Monthly
- Update dependencies
- Review and optimize retention policies
- Capacity planning review
