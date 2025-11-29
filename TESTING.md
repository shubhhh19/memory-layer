# Development Testing Guide

## 📊 Test Results Summary

**Current Status: All repo tests passing (SQLite + mock embeddings)**

✅ **Working:**
- Unit, integration, and E2E suites
- Message creation & retrieval
- Search with embeddings + ranking
- Health checks and metrics
- API key security
- Redis-aware rate limiting (covered via unit tests)

---

## 🧪 Quick Test Commands

### 1. Run All Tests
```bash
make test
# or, when plugin autoloading is disabled (e.g. sandbox/CI)
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest -p pytest_asyncio.plugin

# Expected: All tests pass
```

### 2. Run Specific Test Types
```bash
# Unit tests (all should pass)
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest -p pytest_asyncio.plugin tests/unit/ -v

# Integration tests
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest -p pytest_asyncio.plugin tests/integration/ -v

# End-to-end tests
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest -p pytest_asyncio.plugin tests/e2e/ -v
```

> **Tip:** The harness automatically sets `AIML_USE_PGVECTOR_STUB=1` so SQLite runs
> don't need the pgvector binary. Unset it in production deployments to use the
> real extension.

### 3. Run with Coverage
```bash
pytest --cov=src/ai_memory_layer --cov-report=html
open htmlcov/index.html  # View coverage report
```

---

## 🚀 Manual Testing Steps

### Step 1: Start the Server
```bash
# Start the development server
uvicorn ai_memory_layer.main:app --reload

# Server will be at: http://localhost:8000
# API docs at: http://localhost:8000/docs
```

### Step 2: Test Health Check
```bash
curl http://localhost:8000/v1/admin/health

# Expected response includes `status`, `database`, `uptime_seconds`, `version`
```

### Step 3: Store a Message
```bash
curl -X POST http://localhost:8000/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "test-app",
    "conversation_id": "conv-001",
    "role": "user",
    "content": "I love Python programming and machine learning"
  }'

# Expected: 200 OK when inline embeddings are enabled (default local)
#          202 Accepted when async embeddings are enabled
# Response includes:
# - id (UUID)
# - importance_score (0.0-1.0)
# - embedding_status: "completed"
```

### Step 4: Retrieve the Message
```bash
# Copy the message ID from step 3, then:
curl http://localhost:8000/v1/messages/{message_id}

# Expected: 200 OK with full message details
```

### Step 5: Search for Memories
```bash
# Wait 2-3 seconds after creating message, then:
curl "http://localhost:8000/v1/memory/search?tenant_id=test-app&query=Python&top_k=5"

# Expected: List of relevant messages with scores
```

### Step 6: Check Metrics
```bash
curl http://localhost:8000/metrics

# Expected: Prometheus format metrics
# Look for:
# - http_requests_total
# - http_request_duration_seconds
# - messages_created_total
```

### Step 7: Test API Documentation
```bash
# Open in browser:
open http://localhost:8000/docs

# You can test all endpoints interactively here
```

---

## ✅ What to Test During Development

### Core Functionality Tests

#### 1. Message Storage
- [ ] Create message with all fields
- [ ] Create message with minimal fields
- [ ] Verify importance score is calculated
- [ ] Verify embedding is generated
- [ ] Check message is retrievable by ID

#### 2. Message Retrieval
- [ ] Get message by ID
- [ ] Get non-existent message (should 404)
- [ ] Verify all fields are returned correctly

#### 3. Search (when fixed)
- [ ] Search returns relevant results
- [ ] Search with conversation_id filter
- [ ] Search with importance_min filter
- [ ] Search with top_k parameter
- [ ] Verify results are ranked by score

#### 4. Health & Monitoring
- [ ] Health check returns "ok"
- [ ] Health check includes database status
- [ ] Metrics endpoint returns data
- [ ] Metrics update after requests

#### 5. Security
- [ ] Requests without API key work (when not configured)
- [ ] Requests with valid API key work (when configured)
- [ ] Requests with invalid API key fail (when configured)

### Edge Cases to Test

#### 1. Input Validation
```bash
# Empty content (should fail)
curl -X POST http://localhost:8000/v1/messages \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"test","conversation_id":"c1","role":"user","content":""}'

# Invalid role (should fail)
curl -X POST http://localhost:8000/v1/messages \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"test","conversation_id":"c1","role":"invalid","content":"test"}'

# Very long content (should work up to 100KB)
curl -X POST http://localhost:8000/v1/messages \
  -H "Content-Type: application/json" \
  -d "{\"tenant_id\":\"test\",\"conversation_id\":\"c1\",\"role\":\"user\",\"content\":\"$(python -c 'print("x"*1000)')\"}"
```

#### 2. Concurrent Requests
```bash
# Create multiple messages quickly
for i in {1..10}; do
  curl -X POST http://localhost:8000/v1/messages \
    -H "Content-Type: application/json" \
    -d "{\"tenant_id\":\"test\",\"conversation_id\":\"c$i\",\"role\":\"user\",\"content\":\"Message $i\"}" &
done
wait

# All should succeed
```

#### 3. Different Embedding Providers
```bash
# Test with mock embeddings (default)
export MEMORY_EMBEDDING_PROVIDER=mock
uvicorn ai_memory_layer.main:app --reload

# Test with sentence transformers
export MEMORY_EMBEDDING_PROVIDER=sentence_transformer
uvicorn ai_memory_layer.main:app --reload

# Test with Google Gemini (requires API key)
export MEMORY_EMBEDDING_PROVIDER=google_gemini
export MEMORY_GEMINI_API_KEY=your-key
uvicorn ai_memory_layer.main:app --reload
```

---

## 🐛 Known Issues & Workarounds

No known repo test failures at this time. Run the suite against Postgres/pgvector and Redis for production parity.

---

## 📈 Performance Testing

### Test Response Times
```bash
# Install httpstat
pip install httpstat

# Test message creation
httpstat POST http://localhost:8000/v1/messages \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"test","conversation_id":"c1","role":"user","content":"test"}'

# Look for:
# - Total time < 1 second (with mock embeddings)
# - Total time < 5 seconds (with real embeddings)
```

### Load Testing (Optional)
```bash
# Install Apache Bench
brew install httpd

# Create test payload
echo '{"tenant_id":"load","conversation_id":"c1","role":"user","content":"test"}' > payload.json

# Test 100 requests with 10 concurrent
ab -n 100 -c 10 \
   -p payload.json \
   -T application/json \
   http://localhost:8000/v1/messages

# Look for:
# - No failed requests
# - Mean response time < 1 second
```

---

## ✅ Development Checklist

Before committing code:
- [ ] All unit tests pass
- [ ] Manual API tests work
- [ ] Health check returns OK
- [ ] No errors in server logs
- [ ] Code is formatted (`make format`)
- [ ] Code passes linting (`make lint`)

Before deploying:
- [ ] All tests pass (or known failures documented)
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] API keys set up
- [ ] Health check accessible
- [ ] Metrics endpoint working

---

## 🔍 Debugging Tips

### View Server Logs
```bash
# Server logs show all requests and errors
# Look for:
# - Request logs: "HTTP Request: POST /v1/messages"
# - Error logs: [error] or [warning]
# - Embedding logs: "embedding_generated"
```

### Check Database
```bash
# If using SQLite (default for tests)
sqlite3 memory_layer.db

# View messages
SELECT id, tenant_id, role, content, importance_score 
FROM messages 
LIMIT 5;

# Check if embeddings exist
SELECT id, embedding_status 
FROM messages 
WHERE embedding IS NOT NULL;
```

### Test Embedding Generation
```python
# Test in Python REPL
from ai_memory_layer.services.embedding import build_embedding_service
import asyncio

async def test():
    service = build_embedding_service("mock")
    embedding = await service.embed("test content")
    print(f"Embedding dimensions: {len(embedding)}")
    print(f"First 5 values: {embedding[:5]}")

asyncio.run(test())
```

---

## 📊 Expected Test Results

### Unit Tests: ✅ All Pass
- Retrieval, embedding, importance scoring, scheduler, retention

### Integration Tests: ✅ All Pass (sqlite/mock)
- Admin/health & readiness, metrics, rate limiting, security, messages/search

### E2E Tests: ✅ All Pass (sqlite/mock)

---

## 🎯 Quick Verification Script

Save this as `test_api.sh`:

```bash
#!/bin/bash
set -e

echo "🧪 Testing AI Memory Layer API"
echo "================================"

BASE_URL="http://localhost:8000"

echo "✅ 1. Health Check"
curl -s $BASE_URL/v1/admin/health | jq .

echo -e "\n✅ 2. Create Message"
MSG_ID=$(curl -s -X POST $BASE_URL/v1/messages \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"test","conversation_id":"c1","role":"user","content":"I love Python"}' \
  | jq -r .id)
echo "Created message: $MSG_ID"

echo -e "\n✅ 3. Retrieve Message"
curl -s $BASE_URL/v1/messages/$MSG_ID | jq .

echo -e "\n✅ 4. Metrics"
curl -s $BASE_URL/metrics | grep "http_requests_total"

echo -e "\n\n✅ All basic tests passed!"
```

Run with: `chmod +x test_api.sh && ./test_api.sh`

---

## 📝 Summary

**What's Working:** 86% of functionality (12/14 tests)
**What to Test:** Message storage, retrieval, health, metrics
**Known Issues:** Search (session error), rate limiting (not enforcing)
**Ready for:** Development and testing
**Not ready for:** Production (needs 2 fixes)
