# API Reference

All fields use camelCase. Errors carry correct HTTP status codes.

Base URL: `http://localhost:8000/api/v1`

## Detection & Annotation

| Method | Path | Description |
|--------|------|-------------|
| POST | `/detect` | VLM pre-annotation (multipart, supports `use_sam2` flag) |
| GET | `/detections` | List detections (paginated) |
| GET | `/detections/{id}` | Detection detail |
| GET | `/detections/{id}/image` | Original image |
| POST | `/detections/{id}/boxes` | Add annotation box |
| PUT | `/detections/{id}/boxes` | Replace all boxes |
| PUT | `/detections/{id}/boxes/{boxId}` | Update box coordinates |
| POST | `/detections/{id}/boxes/{boxId}/delete` | Delete box |
| PUT | `/detections/{id}/filter-settings` | Save filter mode & NMS IoU |
| POST | `/detections/{id}/delete` | Delete detection |
| GET | `/detections/{id}/export` | Export single YOLO label |
| POST | `/detections/export-batch` | Multi-format export: `yolo` `yolo-seg` `coco` `voc` `createml` (zip) |

### Model Management

| Method | Path | Description |
|--------|------|-------------|
| GET | `/model/status` | VLM model status (`loaded`, `state`, `progress`) |
| POST | `/model/unload` | Unload VLM model from memory |
| GET | `/model/sam2-status` | SAM2 model status |

## Video

| Method | Path | Description |
|--------|------|-------------|
| POST | `/videos/upload` | Upload video (multipart) |
| GET | `/videos` | List videos (paginated) |
| GET | `/videos/{id}` | Video detail (includes keyframes) |
| GET | `/videos/{id}/file` | Video file download |
| POST | `/videos/{id}/extract-keyframes` | Extract keyframes |
| GET | `/videos/{id}/keyframes/{keyframeId}/image` | Keyframe image |
| POST | `/videos/{id}/delete` | Delete video and keyframes |

## Training

| Method | Path | Description |
|--------|------|-------------|
| POST | `/train/jobs` | Create training job (detect / segment, train/val split) |
| GET | `/train/jobs` | List training jobs (paginated) |
| GET | `/train/variants` | Available YOLO series |
| GET | `/train/jobs/{id}` | Training job detail |
| GET | `/train/jobs/{id}/progress` | Training progress snapshot (JSON) |
| GET | `/train/jobs/{id}/progress/stream` | SSE training progress |
| GET | `/train/jobs/{id}/download` | Download PT model |
| GET | `/train/jobs/{id}/dataset` | Download dataset zip |
| GET | `/train/jobs/{id}/charts/{name}` | Training charts (results.png, etc.) |
| POST | `/train/jobs/{id}/export-onnx` | Export / download ONNX model |
| POST | `/train/jobs/{id}/predict` | YOLO inference (image) |
| POST | `/train/jobs/{id}/retrain` | Re-run with same settings |
| GET | `/train/jobs/{id}/validate-mjpeg/{video_id}` | Validate video (MJPEG live stream) |
| POST | `/train/jobs/{id}/predict-video-stream` | Validate video (SSE stream) |
| POST | `/train/jobs/{id}/predict-video` | Validate video (sync batch) |
| POST | `/train/jobs/{id}/delete` | Delete training job |
| POST | `/train/upload-model` | Upload external YOLO model (.pt) → Token |
| POST | `/train/validate-image/{token}` | Validate image with external model |
| GET | `/train/validate-mjpeg/{token}/{video_id}` | Validate video with external model (MJPEG) |

## Response Format

```json
// Single: 200/201
{ "data": { "id": "...", "imageName": "...", "createdAt": "..." } }

// List: 200
{ "data": [...], "total": 100, "page": 1, "pageSize": 20 }

// Delete: 204 (empty body)

// Error: 4xx/5xx
{ "error": { "code": "NotFoundError", "message": "Detection not found: xxx" } }
```

### Detection Object

```json
{
  "id": "uuid",
  "imageName": "cat.jpg",
  "categories": ["cat"],
  "modelName": "LocateAnything-3B",
  "imageWidth": 1024,
  "imageHeight": 768,
  "elapsedMs": 4500,
  "filterMode": "all",
  "filterNmsIou": null,
  "status": "completed",
  "createdAt": "2026-06-05T12:00:00+08:00",
  "boxes": [
    {
      "id": "uuid",
      "className": "cat",
      "x1": 100, "y1": 200, "x2": 300, "y2": 400,
      "confidence": null,
      "maskPolygon": [[110,210], [115,220], ...]
    }
  ]
}
```

### Training Job Object

```json
{
  "id": "uuid",
  "modelVariant": "yolo26n",
  "epochs": 100,
  "imgsz": 640,
  "batch": 16,
  "trainRatio": 0.7,
  "valRatio": 0.2,
  "taskType": "detect",
  "status": "completed",
  "metrics": {
    "mAP50": 0.85,
    "mAP50-95": 0.62,
    "precision": 0.88,
    "recall": 0.82,
    "num_samples": 50,
    "num_classes": 3
  },
  "modelPath": "/path/to/model.pt",
  "onnxPath": "/path/to/model.onnx",
  "errorMessage": null,
  "createdAt": "2026-06-05T12:00:00+08:00",
  "completedAt": "2026-06-05T12:05:00+08:00",
  "detectionIds": ["uuid1", "uuid2"]
}
```

## Export Formats

Batch export (`POST /detections/export-batch`) returns a zip with format-specific structure:

| Format Key | Files |
|-----------|-------|
| `yolo` | `images/*.{jpg,png}`, `labels/*.txt`, `data.yaml` |
| `yolo-seg` | Same as yolo, labels use polygon format (`class_id x1 y1 x2 y2 ...`) |
| `coco` | `annotations.json` (images, annotations, categories) |
| `voc` | `*.xml` (one per image, Pascal VOC format) |
| `createml` | `annotations.json` (CreateML object detection format) |
