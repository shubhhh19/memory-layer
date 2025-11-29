# AI Memory Layer

**Production-ready backend service for AI chatbot conversation memory with semantic search, importance scoring, and automatic retention policies.**

## 🎯 What This Does

Stores and retrieves conversation memories for AI systems using:
- **Semantic Search**: Find relevant past messages using vector embeddings
- **Importance Scoring**: Automatically prioritize messages by recency, role, and explicit importance
- **Smart Retention**: Archive/delete old messages based on age and importance
- **Rate Limiting**: Protect your API with built-in rate limiting
- **Real Embeddings**: Google Gemini API integration for production-quality embeddings

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- PostgreSQL with pgvector extension (or SQLite for testing)
- Google Gemini API key (free tier available)

### Installation

```bash
# Clone the repository
git clone <your-repo>
cd memory-layer

# Install dependencies
pip install -e ".[dev]"

# Copy environment template
cp .env.example .env

# Edit .env and add your Gemini API key
# MEMORY_GEMINI_API_KEY=your-key-here
# MEMORY_EMBEDDING_PROVIDER=google_gemini
```

### Run Locally

```bash
# Option 1: Using Docker Compose (Recommended)
docker compose up --build
docker compose exec api alembic upgrade head

# Option 2: Local Development
alembic upgrade head
uvicorn ai_memory_layer.main:app --reload

# API will be available at http://localhost:8000
# API docs at http://localhost:8000/docs
```

## 📖 How It Works

### 1. Store a Message
```bash
curl -X POST http://localhost:8000/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "my-app",
    "conversation_id": "conv-123",
    "role": "user",
    "content": "I love Python programming"
  }'
```

### 2. Search Memories
```bash
curl "http://localhost:8000/v1/memory/search?tenant_id=my-app&query=Python&top_k=5"
```

### 3. Check Health
```bash
curl http://localhost:8000/v1/admin/health
```

## 🧪 Testing

```bash
# Run all tests
make test

# Run with coverage
pytest --cov=src/ai_memory_layer --cov-report=html

# Run specific test types
pytest tests/unit/              # Unit tests
pytest tests/integration/       # Integration tests
pytest tests/e2e/               # End-to-end tests
```

## 🏗️ Architecture

```
Client → FastAPI → Services → Repositories → Database
                ↓
         Embedding Service (Google Gemini)
```

**Key Components:**
- **Routes**: API endpoints (`/v1/messages`, `/v1/memory/search`)
- **Services**: Business logic (message ingestion, retrieval, retention)
- **Repositories**: Database access layer
- **Models**: SQLAlchemy ORM models

## 📊 Current Status

✅ **Implemented:**
- Message storage with embeddings
- Semantic search with similarity ranking
- Importance scoring (recency + role + explicit)
- Retention policies (archive/delete)
- Google Gemini embedding integration
- Rate limiting (global + per-tenant) with Redis-backed storage
- CORS configuration
- Health checks & metrics
- API key authentication
- Comprehensive test suite
- Per-tenant & global rate limiting
- Background embedding job queue (in-process worker or standalone)
- Monitoring dashboards & alert rules (Prometheus/Grafana)
- Load testing helper script
- Redis-backed cache for search/embeddings
- Postgres/pgvector vector search (ORDER BY <->) with fallback for SQLite/dev

## 🔧 Configuration

Key environment variables (see `.env.example`):

```bash
# Database
MEMORY_DATABASE_URL=postgresql+asyncpg://user:pass@localhost/memory_layer

# Cache / Rate Limiting
MEMORY_REDIS_URL=redis://localhost:6379/0   # Required in production
MEMORY_REQUIRE_REDIS_IN_PRODUCTION=true

# Embeddings
MEMORY_EMBEDDING_PROVIDER=google_gemini  # or sentence_transformer, mock
MEMORY_GEMINI_API_KEY=your-api-key-here
MEMORY_EMBEDDING_DIMENSIONS=1536  # default; use 768 for Gemini embedding-001
MEMORY_ASYNC_EMBEDDINGS=true  # Enable background worker

# Security
MEMORY_API_KEYS=key1,key2,key3  # Comma-separated
MEMORY_ALLOWED_ORIGINS=*  # Or specific domains

# Rate Limiting
MEMORY_GLOBAL_RATE_LIMIT=200/minute
MEMORY_TENANT_RATE_LIMIT=120/minute

# Notes
# - The embeddings column accepts any configured dimension. Just keep
#   MEMORY_EMBEDDING_DIMENSIONS in sync with your provider (e.g. 768 for Gemini).
# - Redis-backed rate limiting and caching run fully async to avoid blocking the event loop.
# - Set `AIML_USE_PGVECTOR_STUB=1` when running the suite on SQLite-only or sandboxed
#   environments that cannot import the pgvector binary; production deployments
#   should leave this unset to keep real pgvector support.

# Retention
MEMORY_RETENTION_SCHEDULE_SECONDS=86400
MEMORY_RETENTION_TENANTS=*  # "*" runs for all tenants found

# Health/Readiness
MEMORY_HEALTH_EMBED_CHECK_ENABLED=false
MEMORY_READINESS_EMBED_TIMEOUT_SECONDS=3.0
```

## 📚 API Reference

### POST /v1/messages
Store a new message with automatic embedding generation.

**Request:**
```json
{
  "tenant_id": "string",
  "conversation_id": "string",
  "role": "user|assistant|system",
  "content": "string",
  "metadata": {},
  "importance_override": 0.8
}
```

**Response:** `202 Accepted`

### GET /v1/memory/search
Search for relevant memories.

**Query Parameters:**
- `tenant_id` (required)
- `query` (required)
- `conversation_id` (optional)
- `top_k` (default: 5)
- `importance_min` (optional)

**Response:**
```json
{
  "total": 5,
  "items": [{
    "message_id": "uuid",
    "score": 0.85,
    "similarity": 0.92,
    "content": "...",
    "importance": 0.72
  }]
}
```

### GET /v1/admin/health
Lightweight liveness (DB ping).

### GET /v1/admin/readiness
Readiness probe (DB + optional embedding provider check).

### POST /v1/admin/retention/run
Manually trigger retention job.

## ⚙️ Async Embeddings

- Set `MEMORY_ASYNC_EMBEDDINGS=true` to enqueue embedding generation in the background.
- Start the worker alongside the API:
  ```bash
  uv run aiml-worker
  ```
- The API process also runs an in-process queue for small deployments; the worker keeps the job runner isolated for production.
- Responses return `200 OK` when embeddings are computed inline, and `202 Accepted` when queued for background processing.

## 🚢 Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed production deployment guide.

## 📈 Observability

- Prometheus metrics at `/metrics` (request counts/latency, search stats, embedding job durations).
- Grafana dashboard + example alert rules in `docs/monitoring/`.
- Logs are structured (JSON) with request IDs for easy correlation.

## 🧪 Load Testing

Use the bundled async helper to sanity-check throughput and rate limits:

```bash
uv run python scripts/load_test.py --requests 200 --concurrency 25 --api-key <key>
```

Override `--base-url` and `--tenant-id` as needed. The script reports success rate, average latency, and p95 latency.

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please read contributing guidelines first.
