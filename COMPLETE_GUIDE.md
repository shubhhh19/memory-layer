# Complete Guide: AI Memory Layer

## 📚 Table of Contents
1. [Project Overview](#project-overview)
2. [How It Works](#how-it-works)
3. [Architecture & Flow](#architecture--flow)
4. [How to Run](#how-to-run)
5. [How to Use It](#how-to-use-it)
6. [How to Test](#how-to-test)
7. [API Reference](#api-reference)

---

## 🎯 Project Overview

### What Is This?
**AI Memory Layer** is a backend service that stores and retrieves conversation memories for AI chatbots. It helps AI systems remember past conversations without storing everything in the prompt.

### Key Features
- **Store Messages**: Save user/assistant messages with embeddings
- **Search Memories**: Find relevant past messages using semantic search
- **Importance Scoring**: Automatically score message importance
- **Retention Policies**: Archive/delete old messages automatically
- **Production Ready**: Rate limiting, CORS, timeouts, monitoring

### Tech Stack
- **Framework**: FastAPI (Python 3.11+)
- **Database**: PostgreSQL + pgvector (vector similarity search)
- **Embeddings**: sentence-transformers (HuggingFace)
- **ORM**: SQLAlchemy (async)
- **Migrations**: Alembic

---

## 🔄 How It Works

### The Problem It Solves
AI chatbots need context from past conversations, but:
- ❌ Can't store everything in the prompt (too expensive)
- ❌ Need to find relevant past messages quickly
- ❌ Should forget unimportant/old messages

### The Solution
1. **Store** each message with an embedding (text → numbers)
2. **Search** for similar messages when needed
3. **Score** messages by importance (recency, role, explicit)
4. **Archive** old/unimportant messages automatically

### Example Flow
```
User: "I love Python programming"
  ↓
API stores message + generates embedding
  ↓
Later, user asks: "What programming languages do I like?"
  ↓
API searches for similar messages
  ↓
Finds: "I love Python programming"
  ↓
Returns relevant memory to AI
```

---

## 🏗️ Architecture & Flow

### System Architecture

```
┌─────────────────────────────────────────┐
│         Client (AI System)              │
└──────────────┬──────────────────────────┘
               │ HTTP Requests
               ▼
┌─────────────────────────────────────────┐
│         FastAPI Application             │
│  ┌──────────┐  ┌──────────┐  ┌────────┐│
│  │ Messages │  │  Memory  │  │ Admin  ││
│  │  Routes  │  │  Routes  │  │ Routes ││
│  └────┬─────┘  └────┬─────┘  └───┬────┘│
└───────┼─────────────┼─────────────┼─────┘
        │             │             │
        └─────────────┴─────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
┌───────▼────────┐        ┌─────────▼────────┐
│ Service Layer  │        │  Schema Layer    │
│  (Business     │        │  (Validation)    │
│   Logic)       │        │                  │
└───────┬────────┘        └──────────────────┘
        │
        │
┌───────▼──────────────────────────────────┐
│         Repository Layer                 │
│         (Database Access)                │
└───────┬──────────────────────────────────┘
        │
┌───────▼──────────────────────────────────┐
│         Database (Postgres + pgvector)   │
└──────────────────────────────────────────┘
```

### Detailed Flow: Storing a Message

```
1. Client sends POST /v1/messages
   {
     "tenant_id": "acme",
     "conversation_id": "conv-123",
     "role": "user",
     "content": "I love Python"
   }
   │
   ▼
2. API Layer (routes/messages.py)
   - Validates request (Pydantic schema)
   - Checks API key (if configured)
   - Applies rate limiting
   - Calls service.ingest()
   │
   ▼
3. Service Layer (services/message_service.py)
   a) Creates message in database (no embedding yet)
   b) Calculates importance score:
      - Recency: 40% (how recent?)
      - Role: 20% (system=0.9, user=0.7, assistant=0.5)
      - Explicit: 40% (if provided)
   c) Generates embedding:
      - Converts "I love Python" → [0.23, 0.45, ...] (384 numbers)
      - Uses sentence-transformers model
   d) Updates message with embedding + importance
   e) Commits to database
   │
   ▼
4. Repository Layer (repositories/memory_repository.py)
   - Executes SQL: INSERT INTO messages ...
   - Executes SQL: UPDATE messages SET embedding=...
   │
   ▼
5. Database (PostgreSQL)
   - Stores message with vector embedding
   - pgvector extension enables similarity search
   │
   ▼
6. Response
   Returns JSON with message ID, status, importance score
```

### Detailed Flow: Searching Memories

```
1. Client sends GET /v1/memory/search?query=Python&tenant_id=acme
   │
   ▼
2. API Layer (routes/memory.py)
   - Validates query parameters
   - Applies rate limiting
   - Calls service.retrieve()
   │
   ▼
3. Service Layer (services/message_service.py)
   a) Embeds query: "Python" → [0.12, 0.89, ...]
   b) Fetches candidate messages from database:
      - Filters by tenant_id
      - Filters by conversation_id (if provided)
      - Filters by importance_min (if provided)
      - Orders by created_at DESC
      - Limits to candidate_limit (default: 200)
   │
   ▼
4. Retrieval Service (services/retrieval.py)
   For each candidate message:
   a) Calculates similarity:
      - cosine(query_embedding, message_embedding)
      - Range: -1 to 1 (higher = more similar)
   b) Calculates decay:
      - exp(-age_in_days / 7)  # 1-week half-life
      - Recent messages score higher
   c) Gets importance:
      - message.importance_score (0.0-1.0)
   d) Combines scores:
      - final_score = 0.6*similarity + 0.3*importance + 0.1*decay
   e) Sorts by final_score DESC
   f) Returns top_k results
   │
   ▼
5. Response
   Returns JSON with ranked results:
   [
     {
       "message_id": "...",
       "score": 0.85,
       "similarity": 0.92,
       "decay": 0.75,
       "content": "I love Python",
       "importance": 0.8,
       ...
     },
     ...
   ]
```

### Detailed Flow: Retention (Archiving Old Messages)

```
1. Admin triggers POST /v1/admin/retention/run
   {
     "tenant_id": "acme",
     "dry_run": false,
     "actions": ["archive", "delete"]
   }
   │
   ▼
2. Retention Service (services/retention.py)
   a) Loads retention policy for tenant
   b) Finds candidates to archive:
      - Messages older than max_age_days (default: 30)
      - OR importance_score < threshold (default: 0.35)
   c) Moves to archive:
      - INSERT INTO archived_messages ...
      - UPDATE messages SET archived=true
   d) Deletes old archived messages:
      - DELETE FROM archived_messages WHERE archived_at > 90 days
   │
   ▼
3. Response
   Returns counts: { "archived": 42, "deleted": 10 }
```

---

## 🚀 How to Run

### Option 1: Docker Compose (Recommended)

**Easiest way to get started:**

```bash
# 1. Clone and navigate to project
cd memory-layer

# 2. Start services (Postgres + API)
docker compose up --build

# 3. In another terminal, run migrations
docker compose exec api alembic upgrade head

# 4. API is now running at http://localhost:8000
# 5. Visit http://localhost:8000/docs for API documentation
```

**What this does:**
- Starts PostgreSQL with pgvector extension
- Builds and starts the FastAPI application
- Exposes API on port 8000
- Exposes Postgres on port 5432

**Stop services:**
```bash
docker compose down
```

### Option 2: Local Development

**For development with hot reload:**

```bash
# 1. Install dependencies
uv sync
# or
pip install -e .[dev]

# 2. Set up environment
cp .env.example .env
# Edit .env with your settings

# 3. Start PostgreSQL (or use SQLite for testing)
# For Postgres:
createdb memory_layer
# Or use SQLite (default, no setup needed)

# 4. Run migrations
alembic upgrade head

# 5. Start API
uvicorn ai_memory_layer.main:app --reload

# API runs at http://localhost:8000
```

### Option 3: Production Deployment

```bash
# 1. Set environment variables
export MEMORY_DATABASE_URL="postgresql+asyncpg://user:pass@host/db"
export MEMORY_API_KEYS="key1,key2,key3"
export MEMORY_ALLOWED_ORIGINS="https://yourdomain.com"
# ... other variables

# 2. Run migrations
alembic upgrade head

# 3. Start with uvicorn (or use Docker)
uvicorn ai_memory_layer.main:app --host 0.0.0.0 --port 8000

# Or use Docker:
docker build -t ai-memory-layer .
docker run -p 8000:8000 --env-file .env ai-memory-layer
```

---

## 📖 How to Use It

### 1. Store a Message

**Endpoint**: `POST /v1/messages`

**Request:**
```bash
curl -X POST http://localhost:8000/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-key" \
  -d '{
    "tenant_id": "acme",
    "conversation_id": "conv-123",
    "role": "user",
    "content": "I love Python programming and machine learning",
    "metadata": {
      "source": "web",
      "user_id": "user-456"
    }
  }'
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "acme",
  "conversation_id": "conv-123",
  "role": "user",
  "content": "I love Python programming and machine learning",
  "metadata": {},
  "importance_score": 0.72,
  "embedding_status": "completed",
  "created_at": "2025-11-14T20:30:00Z",
  "updated_at": "2025-11-14T20:30:00Z"
}
```

### 2. Search Memories

**Endpoint**: `GET /v1/memory/search`

**Request:**
```bash
curl "http://localhost:8000/v1/memory/search?tenant_id=acme&query=Python&top_k=5" \
  -H "x-api-key: your-key"
```

**Response:**
```json
{
  "total": 5,
  "items": [
    {
      "message_id": "550e8400-e29b-41d4-a716-446655440000",
      "score": 0.85,
      "similarity": 0.92,
      "decay": 0.75,
      "content": "I love Python programming and machine learning",
      "role": "user",
      "metadata": {},
      "created_at": "2025-11-14T20:30:00Z",
      "importance": 0.72
    },
    ...
  ]
}
```

**Query Parameters:**
- `tenant_id` (required): Tenant identifier
- `query` (required): Search query text
- `conversation_id` (optional): Filter to specific conversation
- `top_k` (optional, default: 5): Number of results
- `importance_min` (optional): Minimum importance score
- `candidate_limit` (optional, default: 200): Max candidates to consider

### 3. Get a Specific Message

**Endpoint**: `GET /v1/messages/{message_id}`

**Request:**
```bash
curl "http://localhost:8000/v1/messages/550e8400-e29b-41d4-a716-446655440000" \
  -H "x-api-key: your-key"
```

### 4. Health Check

**Endpoint**: `GET /v1/admin/health`

**Request:**
```bash
curl http://localhost:8000/v1/admin/health
```

**Response:**
```json
{
  "status": "ok",
  "database": "ok",
  "timestamp": "2025-11-14T20:30:00Z",
  "latency_ms": 2.5,
  "uptime_seconds": 3600,
  "environment": "local",
  "version": "0.1.0"
}
```

### 5. Run Retention Job

**Endpoint**: `POST /v1/admin/retention/run`

**Request:**
```bash
curl -X POST http://localhost:8000/v1/admin/retention/run \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-key" \
  -d '{
    "tenant_id": "acme",
    "dry_run": false,
    "actions": ["archive", "delete"]
  }'
```

**Response:**
```json
{
  "archived": 42,
  "deleted": 10,
  "dry_run": false
}
```

### 6. View Metrics

**Endpoint**: `GET /metrics`

**Request:**
```bash
curl http://localhost:8000/metrics
```

**Response:** Prometheus format metrics

---

## 🧪 How to Test

### Test Structure

```
tests/
├── unit/              # Test individual functions/classes
│   ├── services/      # Test business logic
│   └── test_scheduler.py
├── integration/       # Test API endpoints
│   ├── test_api_messages.py
│   ├── test_security.py
│   └── test_rate_limit.py
└── e2e/              # Test full workflows
    └── test_workflow.py
```

### Running Tests

#### Run All Tests
```bash
# Using make
make test

# Using pytest directly
pytest

# With coverage
pytest --cov=src/ai_memory_layer --cov-report=html
```

#### Run Specific Test Types
```bash
# Unit tests only
pytest tests/unit/

# Integration tests only
pytest tests/integration/

# E2E tests only
pytest tests/e2e/

# Specific test file
pytest tests/unit/services/test_importance.py

# Specific test function
pytest tests/unit/services/test_importance.py::test_importance_scoring_respects_recency_and_role
```

#### Run with Verbose Output
```bash
pytest -v -s
```

### Test Examples

#### 1. Unit Test Example

**File**: `tests/unit/services/test_importance.py`

```python
def test_importance_scoring_respects_recency_and_role():
    scorer = ImportanceScorer()
    now = datetime.now(timezone.utc)
    
    # Recent message should score higher
    score_recent = scorer.score(
        created_at=now,
        role="system",
        explicit_importance=None
    )
    
    score_old = scorer.score(
        created_at=now - timedelta(days=2),
        role="assistant",
        explicit_importance=None
    )
    
    assert score_recent > score_old
```

**Run:**
```bash
pytest tests/unit/services/test_importance.py -v
```

#### 2. Integration Test Example

**File**: `tests/integration/test_api_messages.py`

```python
@pytest.mark.asyncio
async def test_create_message(client):
    response = await client.post(
        "/v1/messages",
        json={
            "tenant_id": "test",
            "conversation_id": "conv-1",
            "role": "user",
            "content": "Hello"
        },
        headers={"x-api-key": "test-key"}
    )
    assert response.status_code == 202
    data = response.json()
    assert "id" in data
    assert data["content"] == "Hello"
```

**Run:**
```bash
pytest tests/integration/test_api_messages.py -v
```

#### 3. E2E Test Example

**File**: `tests/e2e/test_workflow.py`

```python
@pytest.mark.asyncio
async def test_full_workflow(client):
    # 1. Store message
    create_resp = await client.post("/v1/messages", json={...})
    message_id = create_resp.json()["id"]
    
    # 2. Search for it
    search_resp = await client.get("/v1/memory/search?query=...")
    assert len(search_resp.json()["items"]) > 0
    
    # 3. Verify it's found
    assert message_id in [item["message_id"] for item in search_resp.json()["items"]]
```

**Run:**
```bash
pytest tests/e2e/test_workflow.py -v
```

### Manual Testing

#### 1. Test with curl

```bash
# 1. Start the API
uvicorn ai_memory_layer.main:app --reload

# 2. Store a message
curl -X POST http://localhost:8000/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "test",
    "conversation_id": "conv-1",
    "role": "user",
    "content": "I love Python"
  }'

# 3. Search for it
curl "http://localhost:8000/v1/memory/search?tenant_id=test&query=Python"

# 4. Check health
curl http://localhost:8000/v1/admin/health
```

#### 2. Test with Python

```python
import httpx

async with httpx.AsyncClient() as client:
    # Store message
    response = await client.post(
        "http://localhost:8000/v1/messages",
        json={
            "tenant_id": "test",
            "conversation_id": "conv-1",
            "role": "user",
            "content": "I love Python"
        }
    )
    print(response.json())
    
    # Search
    response = await client.get(
        "http://localhost:8000/v1/memory/search",
        params={"tenant_id": "test", "query": "Python"}
    )
    print(response.json())
```

#### 3. Test with API Docs

1. Start the API: `uvicorn ai_memory_layer.main:app --reload`
2. Visit: `http://localhost:8000/docs`
3. Use the interactive Swagger UI to test endpoints

### Load Testing

**Using Apache Bench:**
```bash
# Install ab
# macOS: brew install httpd
# Linux: apt-get install apache2-utils

# Test 1000 requests with 10 concurrent
ab -n 1000 -c 10 -H "x-api-key: test-key" \
   -p message.json -T application/json \
   http://localhost:8000/v1/messages
```

**Using Python:**
```python
import asyncio
import httpx

async def load_test():
    async with httpx.AsyncClient() as client:
        tasks = []
        for i in range(100):
            task = client.post(
                "http://localhost:8000/v1/messages",
                json={
                    "tenant_id": "test",
                    "conversation_id": f"conv-{i}",
                    "role": "user",
                    "content": f"Message {i}"
                }
            )
            tasks.append(task)
        results = await asyncio.gather(*tasks)
        print(f"Completed {len(results)} requests")

asyncio.run(load_test())
```

### Test Coverage

**Generate coverage report:**
```bash
pytest --cov=src/ai_memory_layer --cov-report=html
open htmlcov/index.html  # View in browser
```

**Check coverage:**
```bash
pytest --cov=src/ai_memory_layer --cov-report=term-missing
```

---

## 📚 API Reference

### Authentication

If `MEMORY_API_KEYS` is set, include header:
```
x-api-key: your-api-key
```

### Rate Limiting

Default: 200 requests/minute per IP
- Configurable via `MEMORY_GLOBAL_RATE_LIMIT`
- Returns 429 if exceeded

### Endpoints

#### POST /v1/messages
Store a new message.

**Request Body:**
```json
{
  "tenant_id": "string (required, 1-64 chars)",
  "conversation_id": "string (required, 1-128 chars)",
  "role": "user|assistant|system (required)",
  "content": "string (required, 1-100000 chars)",
  "metadata": "object (optional)",
  "importance_override": "float 0.0-1.0 (optional)"
}
```

**Response:** 202 Accepted
```json
{
  "id": "uuid",
  "tenant_id": "string",
  "conversation_id": "string",
  "role": "string",
  "content": "string",
  "metadata": {},
  "importance_score": 0.72,
  "embedding_status": "completed",
  "created_at": "ISO datetime",
  "updated_at": "ISO datetime"
}
```

#### GET /v1/messages/{message_id}
Get a specific message.

**Response:** 200 OK or 404 Not Found

#### GET /v1/memory/search
Search for relevant memories.

**Query Parameters:**
- `tenant_id` (required): string
- `query` (required): string
- `conversation_id` (optional): string
- `top_k` (optional): int, default 5
- `importance_min` (optional): float
- `candidate_limit` (optional): int, default 200

**Response:** 200 OK
```json
{
  "total": 5,
  "items": [
    {
      "message_id": "uuid",
      "score": 0.85,
      "similarity": 0.92,
      "decay": 0.75,
      "content": "string",
      "role": "string",
      "metadata": {},
      "created_at": "ISO datetime",
      "importance": 0.72
    }
  ]
}
```

#### POST /v1/admin/retention/run
Run retention job (archive/delete old messages).

**Request Body:**
```json
{
  "tenant_id": "string (required)",
  "dry_run": "boolean (optional, default false)",
  "actions": ["archive", "delete"] (required)
}
```

**Response:** 200 OK
```json
{
  "archived": 42,
  "deleted": 10,
  "dry_run": false
}
```

#### GET /v1/admin/health
Health check endpoint.

**Response:** 200 OK
```json
{
  "status": "ok|degraded",
  "database": "ok|down",
  "timestamp": "ISO datetime",
  "latency_ms": 2.5,
  "uptime_seconds": 3600,
  "environment": "local",
  "version": "0.1.0"
}
```

#### GET /metrics
Prometheus metrics (no auth required).

---

## 🔧 Configuration

### Environment Variables

See `.env.example` for all options. Key variables:

```bash
# Database
MEMORY_DATABASE_URL=postgresql+asyncpg://user:pass@host/db

# Security
MEMORY_API_KEYS=key1,key2,key3
MEMORY_ALLOWED_ORIGINS=https://yourdomain.com

# Rate Limiting
MEMORY_GLOBAL_RATE_LIMIT=200/minute

# Timeouts
MEMORY_REQUEST_TIMEOUT_SECONDS=15

# Embeddings
MEMORY_EMBEDDING_PROVIDER=sentence_transformer
MEMORY_EMBEDDING_MODEL_NAME=sentence-transformers/all-MiniLM-L6-v2

# Retention
MEMORY_RETENTION_MAX_AGE_DAYS=30
MEMORY_RETENTION_SCHEDULE_SECONDS=3600
```

---

## 🐛 Troubleshooting

### API won't start
- Check database connection: `MEMORY_DATABASE_URL`
- Check port 8000 is available
- Check logs for errors

### Rate limit errors
- Increase `MEMORY_GLOBAL_RATE_LIMIT`
- Check if multiple clients using same IP

### Slow searches
- Check database indexes: `alembic upgrade head`
- Reduce `candidate_limit` parameter
- Check database connection pool size

### Embedding failures
- Check `MEMORY_EMBEDDING_PROVIDER` is correct
- For sentence-transformers, model downloads on first use
- Check logs for specific errors

---

## 📖 Next Steps

1. **Read the code**: Start with `src/ai_memory_layer/main.py`
2. **Run locally**: Use Docker Compose
3. **Test**: Run `make test`
4. **Explore API**: Visit `http://localhost:8000/docs`
5. **Deploy**: Follow production deployment guide

---

## 🎓 Learning Resources

- **FastAPI Docs**: https://fastapi.tiangolo.com/
- **SQLAlchemy Async**: https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html
- **pgvector**: https://github.com/pgvector/pgvector
- **sentence-transformers**: https://www.sbert.net/

---

**Happy coding!** 🚀

