"""FastAPI application entrypoint."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ai_memory_layer import __version__
from ai_memory_layer.config import get_settings
from ai_memory_layer.database import engine, init_engine, read_engines
from ai_memory_layer.errors import register_exception_handlers
from ai_memory_layer.logging import configure_logging, get_logger
from ai_memory_layer.middleware import (
    RequestIDMiddleware,
    RequestSizeLimitMiddleware,
    SecurityHeadersMiddleware,
    TimeoutMiddleware,
)
from ai_memory_layer.metrics import MetricsMiddleware, router as metrics_router
from ai_memory_layer.rate_limit import RateLimitMiddleware
from ai_memory_layer.routes import api_router
from ai_memory_layer.scheduler import RetentionScheduler
from ai_memory_layer.services.job_queue import EmbeddingJobQueue

configure_logging()
logger = get_logger(component="main")
START_TIME = datetime.now(timezone.utc)
SCHEDULER: RetentionScheduler | None = None
JOB_QUEUE: EmbeddingJobQueue | None = None


async def check_migrations() -> None:
    """Check if database migrations are up to date."""
    try:
        from alembic.config import Config
        from alembic.script import ScriptDirectory
        from alembic.runtime.migration import MigrationContext
        from sqlalchemy import text
        from sqlalchemy.ext.asyncio import create_async_engine

        if engine is None:
            return

        # Get sync URL for Alembic
        settings = get_settings()
        sync_url = settings.sync_database_url()
        
        # Create a sync engine for Alembic
        from sqlalchemy import create_engine
        sync_engine = create_engine(sync_url)

        async with engine.connect() as connection:
            # Check if alembic_version table exists (works for both Postgres and SQLite)
            if "postgresql" in settings.database_url.lower():
                result = await connection.execute(
                    text(
                        "SELECT EXISTS (SELECT FROM information_schema.tables "
                        "WHERE table_name = 'alembic_version')"
                    )
                )
                table_exists = result.scalar()
            else:
                # SQLite
                result = await connection.execute(
                    text(
                        "SELECT name FROM sqlite_master "
                        "WHERE type='table' AND name='alembic_version'"
                    )
                )
                table_exists = result.scalar() is not None

            if not table_exists:
                logger.warning("migrations_table_missing", message="Alembic version table not found. Run migrations.")
                sync_engine.dispose()
                return

        # Get current database revision using sync connection
        with sync_engine.connect() as sync_conn:
            context = MigrationContext.configure(sync_conn)
            current_rev = context.get_current_revision()

            # Get head revision from alembic
            alembic_cfg = Config("alembic.ini")
            script = ScriptDirectory.from_config(alembic_cfg)
            head_rev = script.get_current_head()

            if current_rev != head_rev:
                logger.warning(
                    "migrations_out_of_date",
                    current=current_rev,
                    head=head_rev,
                    message="Database migrations are out of date. Run: alembic upgrade head",
                )
            else:
                logger.info("migrations_up_to_date", revision=current_rev)

        sync_engine.dispose()
    except Exception as exc:
        # Don't fail startup if migration check fails
        logger.warning("migration_check_failed", error=str(exc))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager with startup and shutdown logic."""
    # Startup
    logger.info("application_starting", version=__version__)
    try:
        await init_engine()
        await check_migrations()
        global SCHEDULER  # noqa: PLW0602
        SCHEDULER = RetentionScheduler()
        await SCHEDULER.start()
        if get_settings().async_embeddings:
            global JOB_QUEUE  # noqa: PLW0602
            JOB_QUEUE = EmbeddingJobQueue()
            await JOB_QUEUE.start()
        logger.info("application_started", version=__version__)
    except Exception as exc:
        logger.exception("application_startup_failed", error=str(exc))
        raise

    yield

    # Shutdown
    logger.info("application_shutting_down")
    try:
        if SCHEDULER:
            await SCHEDULER.stop()
        if JOB_QUEUE:
            await JOB_QUEUE.stop()
        if engine:
            await engine.dispose()
        if read_engines:
            for replica in read_engines:
                await replica.dispose()
        logger.info("application_shutdown_complete")
    except Exception as exc:
        logger.exception("application_shutdown_error", error=str(exc))



def create_app() -> FastAPI:
    settings = get_settings()
    
    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        lifespan=lifespan,
    )

    register_exception_handlers(app)
    
    # Add middlewares in order (last added = first executed)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestSizeLimitMiddleware, max_bytes=settings.request_max_bytes)
    app.add_middleware(RequestIDMiddleware)
    app.add_middleware(
        RateLimitMiddleware,
        rate_limit=settings.global_rate_limit,
        tenant_rate_limit=settings.tenant_rate_limit,
    )
    app.add_middleware(TimeoutMiddleware, timeout=settings.request_timeout_seconds)
    if settings.metrics_enabled:
        app.add_middleware(MetricsMiddleware)
        app.include_router(metrics_router, tags=["metrics"])
    app.include_router(api_router)
    app.state.start_time = START_TIME
    return app


app = create_app()


def run() -> None:
    import uvicorn

    uvicorn.run(
        "ai_memory_layer.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )


if __name__ == "__main__":
    run()
