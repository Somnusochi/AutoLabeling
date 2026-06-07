import asyncio
import logging
import time

from ..core.exceptions import AppError
from ..models.detection import Detection, ModelType
from ..repositories.detection import DetectionRepository
from ..schemas.detection import DetectionParams
from .detection_strategy import create_strategy
from .locate_anything import is_model_loaded, unload_model
from .sam2_service import is_sam_loaded, unload_sam
from .sam3_client import is_sam3_running, stop_sam3_server

logger = logging.getLogger(__name__)


async def process_detection(
    filepath: str,
    original_name: str,
    categories: list[str],
    params: DetectionParams,
    repo: DetectionRepository,
) -> Detection:
    """Orchestrates model offloading, inference strategy, and database persistence."""

    # 1. Unload the competing model to free GPU memory
    if params.use_sam3:
        if is_model_loaded():
            unload_model()
        if is_sam_loaded():
            unload_sam()
    else:
        if is_sam3_running():
            stop_sam3_server()

    # 2. Setup strategy
    strategy = create_strategy(use_sam2=params.use_sam2, use_sam3=params.use_sam3)
    strategy_kwargs = {
        "sam2_score_threshold": params.sam2_score_threshold,
        "use_sam3_seg": params.use_sam3_seg,
        "sam3_threshold": params.sam3_threshold,
        "sam3_mask_threshold": params.sam3_mask_threshold,
    }

    t0 = time.perf_counter()

    # 3. Execute inference
    try:
        result = await asyncio.to_thread(strategy.detect, filepath, categories, **strategy_kwargs)
    except AppError:
        raise
    except Exception as exc:
        logger.exception("Inference failed")
        raise AppError("Inference failed", 500) from exc

    # 4. Transactional persistence
    if params.use_sam3:
        model_type = ModelType.sam3
    elif params.use_sam2:
        model_type = ModelType.vlm_sam2
    else:
        model_type = ModelType.vlm

    detection = repo.create(
        image_path=filepath,
        image_name=original_name,
        image_width=result.img_w,
        image_height=result.img_h,
        categories=categories,
    )
    detection.model_type = model_type
    detection.elapsed_ms = int((time.perf_counter() - t0) * 1000)

    polys = result.polygons
    box_dicts: list[dict] = [
        {
            "class_name": b.get("class_name") or categories[0] or "object",
            "x1": b["x1"],
            "y1": b["y1"],
            "x2": b["x2"],
            "y2": b["y2"],
            "confidence": b.get("confidence"),
            "mask_polygon": polys[i] if i < len(polys) else None,
        }
        for i, b in enumerate(result.boxes)
    ]

    repo.add_boxes(str(detection.id), box_dicts)
    repo.db.commit()
    repo.db.refresh(detection)

    return detection
