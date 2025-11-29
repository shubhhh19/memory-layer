"""Routes for message ingestion."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ai_memory_layer.database import get_read_session, get_session
from ai_memory_layer.schemas.messages import MessageCreate, MessageResponse
from ai_memory_layer.security import require_api_key
from ai_memory_layer.services.message_service import MessageService

router = APIRouter(dependencies=[Depends(require_api_key)])
service = MessageService()


@router.post("", response_model=MessageResponse)
async def create_message(
    payload: MessageCreate,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> MessageResponse:
    result = await service.ingest(session, payload)
    # Inline embeddings return 200; async queue returns 202 to signal eventual consistency
    response.status_code = (
        status.HTTP_202_ACCEPTED if service.settings.async_embeddings else status.HTTP_200_OK
    )
    return result


@router.get("/{message_id}", response_model=MessageResponse)
async def get_message(
    message_id: str,
    session: AsyncSession = Depends(get_session),
) -> MessageResponse:
    try:
        message_uuid = UUID(message_id)
    except ValueError as exc:  # pragma: no cover - FastAPI validation handles normally
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid message id") from exc
    result = await service.fetch(session, message_uuid)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    return result
