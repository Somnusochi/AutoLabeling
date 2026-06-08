"""SAM3 standalone server — runs on its own port with transformers 5.x.

Usage:
    pip install "transformers>=5.0" torch Pillow numpy opencv-python-headless
    python sam3_server.py --port 8002
"""

from __future__ import annotations

import argparse
import io
import json
import logging
import os
import sys
from wsgiref.simple_server import make_server

import numpy as np
import torch
from PIL import Image

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("sam3-server")

DEVICE = "cpu"


def load_model(state: dict):
    global DEVICE
    from transformers import Sam3Model, Sam3Processor

    if torch.cuda.is_available():
        DEVICE = "cuda"
    elif torch.backends.mps.is_available():
        DEVICE = "mps"

    logger.info("Loading SAM3 to %s (bfloat16)...", DEVICE)
    state["status"] = "loading"
    state["device"] = DEVICE

    try:
        # Use local_files_only when HF_TOKEN is not set (model already cached)
        local_only = not os.environ.get("HF_TOKEN")
        model = (
            Sam3Model.from_pretrained(
                "facebook/sam3",
                torch_dtype=torch.bfloat16,
                local_files_only=local_only,
            )
            .to(DEVICE)
            .eval()
        )
        processor = Sam3Processor.from_pretrained("facebook/sam3", local_files_only=local_only)
        model.eval()

        state["model"] = model
        state["processor"] = processor
        state["status"] = "loaded"
        logger.info("SAM3 ready on %s", DEVICE)
    except Exception:
        logger.exception("Failed to load SAM3 model")
        state["status"] = "error"
        state["error"] = str(sys.exc_info()[1])


def segment(
    model,
    processor,
    image_bytes,
    text="",
    segmentation=True,
    threshold=0.5,
    mask_threshold=0.5,
):
    """Text-based PCS: SAM3 detects + segments all instances matching text."""
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    inputs = processor(images=img, text=text or None, return_tensors="pt")
    inputs = {k: v.to(DEVICE) if hasattr(v, "to") else v for k, v in inputs.items()}

    with torch.no_grad():
        outputs = model(**inputs)

    results = processor.post_process_instance_segmentation(
        outputs,
        threshold=threshold,
        mask_threshold=mask_threshold,
        target_sizes=inputs.get("original_sizes").tolist(),
    )[0]

    masks_list = results.get("masks", []) if segmentation else []
    boxes_list = results.get("boxes", [])
    scores_list = results.get("scores", [])

    if segmentation:
        try:
            import cv2
        except ImportError:
            cv2 = None
    else:
        cv2 = None

    boxes_out = []
    for i in range(len(boxes_list)):
        bbox = boxes_list[i].tolist() if hasattr(boxes_list[i], "tolist") else boxes_list[i]
        score = float(scores_list[i]) if i < len(scores_list) else 0.0
        poly = []
        if i < len(masks_list) and cv2 is not None:
            mask_u8 = masks_list[i].cpu().numpy().astype(np.uint8)
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
            mask_u8 = cv2.morphologyEx(mask_u8, cv2.MORPH_CLOSE, kernel)
            contours, _ = cv2.findContours(mask_u8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if contours:
                largest = max(contours, key=cv2.contourArea)
                if len(largest) >= 3:
                    pts = largest.squeeze(1).tolist()
                    poly = [[float(p[0]), float(p[1])] for p in pts]
        boxes_out.append(
            {
                "x1": int(bbox[0]),
                "y1": int(bbox[1]),
                "x2": int(bbox[2]),
                "y2": int(bbox[3]),
                "confidence": score,
                "mask_polygon": poly if poly else None,
                "class_name": text or "object",
            }
        )
    return boxes_out


def _parse_multipart(body: bytes, content_type: str) -> dict[str, bytes]:
    """Parse multipart/form-data without cgi (removed in Python 3.13+)."""
    import re

    boundary = content_type.split("boundary=", 1)[1].strip()
    if boundary.startswith('"') and boundary.endswith('"'):
        boundary = boundary[1:-1]
    boundary_bytes = boundary.encode()

    parts = body.split(b"--" + boundary_bytes)
    result: dict[str, bytes] = {}

    for part in parts:
        if part in (b"--\r\n", b"--"):
            break
        if not part.startswith(b"\r\n"):
            continue
        part = part[2:]  # strip leading \r\n

        header_end = part.find(b"\r\n\r\n")
        if header_end == -1:
            continue
        headers_block = part[:header_end].decode("latin-1")
        value = part[header_end + 4 :]
        if value.endswith(b"\r\n"):
            value = value[:-2]

        disp_match = re.search(r'name="([^"]*)"', headers_block)
        if not disp_match:
            continue
        name = disp_match.group(1)
        result[name] = value

    return result


_CORS_HEADERS = [
    ("Access-Control-Allow-Origin", "*"),
    ("Access-Control-Allow-Methods", "GET, POST, OPTIONS"),
    ("Access-Control-Allow-Headers", "*"),
]


def application(environ, start_response):
    path = environ.get("PATH_INFO", "/")

    # Handle CORS preflight
    if environ.get("REQUEST_METHOD") == "OPTIONS":
        start_response("204 No Content", _CORS_HEADERS)
        return [b""]

    if path == "/health":
        status = server_state.get("status", "unloaded")
        body = json.dumps(
            {
                "status": status,
                "device": server_state.get("device", ""),
                "error": server_state.get("error", ""),
            }
        )
        start_response("200 OK", [("Content-Type", "application/json")] + _CORS_HEADERS)
        return [body.encode()]
    if path == "/segment" and environ.get("REQUEST_METHOD") == "POST":
        try:
            if server_state.get("status") != "loaded":
                resp = json.dumps({"error": "Model is not loaded yet"})
                start_response(
                    "503 Service Unavailable",
                    [("Content-Type", "application/json")] + _CORS_HEADERS,
                )
                return [resp.encode()]

            length = int(environ.get("CONTENT_LENGTH", 0))
            body = environ["wsgi.input"].read(length)
            ct = environ.get("CONTENT_TYPE", "")
            form = _parse_multipart(body, ct)
            image_bytes = form.get("file", b"")
            text = form.get("text", b"").decode() or ""
            segmentation = form.get("segmentation", b"true").decode().lower() != "false"
            threshold = float(form.get("threshold", b"0.5").decode() or "0.5")
            mask_threshold = float(form.get("mask_threshold", b"0.5").decode() or "0.5")
            boxes = segment(
                server_state["model"],
                server_state["processor"],
                image_bytes,
                text,
                segmentation,
                threshold,
                mask_threshold,
            )
            resp = json.dumps({"boxes": boxes})
            start_response("200 OK", [("Content-Type", "application/json")] + _CORS_HEADERS)
            return [resp.encode()]
        except Exception as exc:
            logger.exception("Segment failed")
            start_response(
                "500 Internal Server Error",
                [("Content-Type", "application/json")] + _CORS_HEADERS,
            )
            return [json.dumps({"error": str(exc)}).encode()]
    start_response("404 Not Found", [("Content-Type", "text/plain")] + _CORS_HEADERS)
    return [b"Not found"]


server_state = {}


def main():
    import threading

    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8002)
    args = parser.parse_args()

    server_state["status"] = "starting"

    # Start HTTP server first so /health responds immediately
    httpd = make_server("127.0.0.1", args.port, application)
    logger.info("SAM3 server listening on http://127.0.0.1:%d", args.port)

    # Load model in background
    threading.Thread(target=load_model, args=(server_state,), daemon=True).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down")


if __name__ == "__main__":
    main()
