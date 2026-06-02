from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from starlette.responses import Response

from ...core.database import get_db
from ...schemas.detection import ExportBatchIn
from ...services.export import export_batch, export_single

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["export"])


@router.get("/detections/{detection_id}/export")
def download_single_yolo(
    detection_id: str,
    db: Session = Depends(get_db),
) -> PlainTextResponse:
    try:
        content, image_name = export_single(db, detection_id)
    except Exception as exc:
        raise HTTPException(404, detail=str(exc)) from exc

    base = Path(image_name).stem
    return PlainTextResponse(
        content=content,
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{base}.txt"'},
    )


@router.post("/detections/export-batch")
def download_batch_yolo(
    body: ExportBatchIn,
    db: Session = Depends(get_db),
) -> Response:
    data = export_batch(db, body.detection_ids)
    return Response(
        content=data,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=yolo_labels.zip"},
    )
