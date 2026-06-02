"""LocateAnything model service — follows official NVIDIA Worker pattern.

Tested on: M4 Pro (MPS), transformers==4.57.1, torch bfloat16.
"""
from __future__ import annotations

import logging
import re
import sys
from pathlib import Path

import torch
from PIL import Image

from ..core.config import settings
from ..core.exceptions import InferenceError, ModelNotLoadedError

logger = logging.getLogger(__name__)

# decord is Linux-only; on macOS we provide a stub
_decord_loaded = False


def _ensure_decord_stub():
    global _decord_loaded
    if _decord_loaded:
        return
    if sys.platform == "darwin":
        stub_dir = str(Path(settings.resolved_model_dir) / "stubs")
        if Path(stub_dir).exists() and stub_dir not in sys.path:
            sys.path.insert(0, stub_dir)
    _decord_loaded = True


class LocateAnythingWorker:
    def __init__(self, model_path: str, device: str = "mps"):
        _ensure_decord_stub()

        from transformers import AutoModel, AutoProcessor, AutoTokenizer

        self.device = device
        self.dtype = torch.bfloat16

        logger.info("Loading tokenizer...")
        self.tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)

        logger.info("Loading processor...")
        self.processor = AutoProcessor.from_pretrained(model_path, trust_remote_code=True)

        logger.info("Loading model to %s...", device)
        self.model = (
            AutoModel.from_pretrained(
                model_path,
                torch_dtype=self.dtype,
                trust_remote_code=True,
            )
            .to(device)
            .eval()
        )
        logger.info("LocateAnything model ready on %s", device)

    @torch.no_grad()
    def detect(self, image: Image.Image, categories: list[str]) -> dict:
        cats = "</c>".join(categories)
        prompt = f"Locate all the instances that matches the following description: {cats}."
        return self._predict(image, prompt)

    @torch.no_grad()
    def _predict(
        self,
        image: Image.Image,
        question: str,
        generation_mode: str = "hybrid",
        max_new_tokens: int = 2048,
    ) -> dict:
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": image},
                    {"type": "text", "text": question},
                ],
            }
        ]

        text = self.processor.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
        images, videos = self.processor.process_vision_info(messages)
        inputs = self.processor(text=[text], images=images, videos=videos, return_tensors="pt")
        # Safely move tensors only (some fields are numpy arrays)
        inputs = {k: v.to(self.device) if hasattr(v, "to") else v for k, v in inputs.items()}

        response = self.model.generate(
            pixel_values=inputs["pixel_values"].to(self.dtype),
            input_ids=inputs["input_ids"],
            attention_mask=inputs["attention_mask"],
            image_grid_hws=inputs.get("image_grid_hws", None),
            tokenizer=self.tokenizer,
            max_new_tokens=max_new_tokens,
            use_cache=True,
            generation_mode=generation_mode,
            temperature=0.7,
            do_sample=True,
            top_p=0.9,
            repetition_penalty=1.1,
            verbose=False,
        )

        raw_text = response[0] if isinstance(response, tuple) else response
        return {"answer": raw_text}


# ── Module-level singleton ────────────────────────────

_worker: LocateAnythingWorker | None = None


def _get_worker() -> LocateAnythingWorker:
    global _worker
    if _worker is None:
        model_path = (
            settings.resolved_model_dir
            if Path(settings.resolved_model_dir).exists()
            else settings.model_id
        )
        _worker = LocateAnythingWorker(model_path, device=settings.resolved_device)
    return _worker


_PAIR_PATTERN = re.compile(
    r"<ref>([^<]+)</ref>\s*<box><(\d+)><(\d+)><(\d+)><(\d+)></box>"
)
_BOX_ONLY_PATTERN = re.compile(r"<box><(\d+)><(\d+)><(\d+)><(\d+)></box>")


def parse_boxes(raw_text: str, img_w: int, img_h: int) -> list[dict]:
    """Parse model output into boxes with class names.

    Supports both formats:
      <ref>fire</ref><box><34><14><961><997></box>   (with class label)
      <box><34><14><961><997></box>                     (without)
    """
    boxes: list[dict] = []

    # Try ref+box pairs first
    for match in _PAIR_PATTERN.finditer(raw_text):
        class_name, x1, y1, x2, y2 = match.groups()
        boxes.append({
            "class_name": class_name.strip(),
            "x1": int(int(x1) / 1000 * img_w),
            "y1": int(int(y1) / 1000 * img_h),
            "x2": int(int(x2) / 1000 * img_w),
            "y2": int(int(y2) / 1000 * img_h),
        })

    # If no ref+box pairs found, fall back to box-only
    if not boxes:
        for match in _BOX_ONLY_PATTERN.finditer(raw_text):
            x1, y1, x2, y2 = map(int, match.groups())
            boxes.append({
                "class_name": "",
                "x1": int(x1 / 1000 * img_w),
                "y1": int(y1 / 1000 * img_h),
                "x2": int(x2 / 1000 * img_w),
                "y2": int(y2 / 1000 * img_h),
            })

    return boxes


MAX_IMAGE_PX = 1024 * 1024  # ~1MP, safe for 24GB unified memory


def detect(image_path: str | Path, categories: list[str]) -> dict:
    worker = _get_worker()
    img = Image.open(image_path).convert("RGB")
    w, h = img.size

    # Downscale large images to avoid MPS OOM (ViT attention is quadratic)
    if w * h > MAX_IMAGE_PX:
        scale = (MAX_IMAGE_PX / (w * h)) ** 0.5
        new_w, new_h = int(w * scale), int(h * scale)
        logger.info("Resizing image %dx%d -> %dx%d", w, h, new_w, new_h)
        img = img.resize((new_w, new_h), Image.LANCZOS)
        w, h = new_w, new_h

    try:
        result = worker.detect(img, categories)
        raw_text = result["answer"]
    except Exception as exc:
        raise InferenceError() from exc

    boxes = parse_boxes(raw_text, w, h)
    logger.info("Detection: %s -> %d boxes for %s", image_path, len(boxes), categories)
    return {"raw_text": raw_text, "boxes": boxes, "img_w": w, "img_h": h}


def unload_model() -> None:
    global _worker
    _worker = None
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    elif torch.backends.mps.is_available():
        torch.mps.empty_cache()
    logger.info("Model unloaded")
