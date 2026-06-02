# AutoLabeling

[中文文档](README.md) | English

End-to-end **pre-annotation & training system** powered by NVIDIA LocateAnything-3B VLM.

> Images in, model out — VLM auto-labeling + manual refinement + one-click YOLO training + validation.

**Pipeline**: VLM Pre-annotation → Manual Refinement → Export Dataset → Train YOLO → Validate Model

## Screenshots

| VLM Pre-annotation & Refinement | YOLO Training |
|--------------------------------|---------------|
| ![VLM pre-annotation and refinement](docs/1.png) | ![YOLO training](docs/2.png) |

| Video Keyframe Entry | Model Validation |
|---------------------|-----------------|
| ![Video keyframe entry](docs/4.png) | ![Model validation](docs/3.png) |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Visual Grounding | NVIDIA LocateAnything-3B (Qwen2.5-3B + MoonViT) |
| Object Detection | YOLOv5 / v8 / v11 / v26 (Ultralytics) |
| Backend | Python FastAPI + PostgreSQL + SSE |
| Frontend | React + TypeScript + Vite + Tailwind CSS + antd |
| State Management | TanStack Query + ahooks |
| Video Processing | ffmpeg (scene detection / motion detection / interval extraction) |
| Tooling | pnpm, ESLint, Prettier |

## Quick Start

### Requirements

| Resource | Minimum |
|----------|---------|
| Python | 3.12+ |
| Node.js | 22+ |
| PostgreSQL | 16+ |
| ffmpeg | Any version |
| macOS | Apple Silicon 24GB unified memory |
| NVIDIA GPU | 10GB VRAM |
| CPU mode | 16GB system RAM |

### Setup

```bash
git clone https://github.com/Somnusochi/AutoLabeling.git
cd AutoLabeling

# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd ..

# Frontend
cd frontend
pnpm install
cd ..

# Database
psql -d postgres -c "CREATE DATABASE autolabeling;"

# Config
cp backend/.env.example backend/.env

# Database migrations
cd backend
PYTHONPATH=. alembic upgrade head
```

### Model Download (Optional)

```bash
# Auto-downloaded on first run. Pre-download if network is slow:
huggingface-cli download nvidia/LocateAnything-3B --local-dir backend/model
```

### Launch

```bash
# macOS / Linux
./start.sh

# Windows
start.bat
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

### Docker

```bash
docker compose up -d
```

## Project Structure

```
AutoLabeling/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py              # Dependency injection
│   │   │   └── routes/              # REST API
│   │   │       ├── detection.py     # Detection CRUD, manual annotation
│   │   │       ├── export.py        # YOLO format export
│   │   │       ├── train.py         # Training, SSE, validation
│   │   │       └── video.py         # Video upload, keyframe extraction
│   │   ├── core/                    # Config, database, middleware, logging
│   │   ├── models/                  # SQLAlchemy ORM
│   │   │   ├── detection.py         # Detection & bounding boxes
│   │   │   ├── train.py             # Training jobs
│   │   │   └── video.py             # Video & keyframes
│   │   ├── repositories/            # Data access layer
│   │   ├── schemas/                 # Pydantic models (camelCase)
│   │   ├── services/
│   │   │   ├── box_filter.py        # Box filtering, NMS dedup
│   │   │   ├── locate_anything.py   # VLM inference engine
│   │   │   ├── video_service.py     # ffmpeg keyframe extraction + SSIM dedup
│   │   │   ├── trainer.py           # YOLO training + validation
│   │   │   ├── export.py            # Annotation export
│   │   │   └── yolo_format.py       # YOLO format conversion
│   │   └── main.py                  # FastAPI entry point
│   ├── alembic/                     # Database migrations
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/              # UI components
│       │   ├── DetectionCanvas.tsx  # Image annotation canvas
│       │   ├── DetectionResult.tsx  # Detection result display
│       │   ├── VideoPanel.tsx       # Video upload & keyframe timeline
│       │   ├── VideoDetail.tsx      # Keyframe detail view
│       │   ├── KeyframeGrid.tsx     # Keyframe grid
│       │   ├── TrainingPanel.tsx    # YOLO training panel
│       │   └── ...
│       ├── pages/Home.tsx           # Main page (image/video dual mode)
│       ├── hooks/                   # Custom hooks
│       ├── services/api.ts          # Unified API layer (camelCase)
│       ├── lib/                     # Constants, utilities
│       └── types/                   # TypeScript types
├── docs/                            # Screenshots
├── docker-compose.yml
├── start.sh / start.bat             # Launch scripts
└── README.md
```

## Features

### VLM Pre-annotation

Upload images or video keyframes with open-vocabulary descriptions (e.g. `fire, smoke`, `red car`). LocateAnything-3B automatically detects and draws bounding boxes.

- Open-vocabulary: describe anything in natural language
- Auto-resize large images to prevent OOM
- Batch upload: drag a folder or load video keyframes, stream results as they arrive
- Streaming: first result appears immediately, subsequent results append in real time

### Video Annotation

Upload a video, extract keyframes intelligently, select and batch-annotate.

- **Three extraction modes**: scene change detection, motion detection (optical flow), fixed interval
- **SSIM deduplication**: automatically removes near-duplicate frames, threshold adjustable
- **Timeline preview**: horizontal scrollable strip for browsing all keyframes, click for full-size preview
- **Multi-select**: check individual frames, select all / deselect all, load selected frames to annotation queue
- Loaded keyframes go through the standard VLM pre-annotation pipeline, same experience as image annotation

### Manual Annotation

Canvas drawing mode for precise box annotation.

- Toggle between View / Draw modes
- Category quick-fill from history
- VLM pre-annotation as baseline → delete mistakes → fill gaps
- Filter boxes with All / Best / NMS modes
- Saved filter settings are applied by backend export and training dataset generation
- Temporarily hide individual boxes while inspecting dense detections
- Per-frame re-detection

### History Management

- Thumbnail previews with category tags
- Multi-select tag filtering
- Click to view details, re-detect with updated labels
- Export single or batch YOLO format labels
- Single-image `.txt` export runs in the browser; batch export uses backend zip generation
- History list refreshes in real time after saving filter results

### YOLO Training

- Multi-series: YOLOv5 / v8 / v11 / v26 (n/s/m/l/x)
- Tag filter + thumbnail preview for precise training data selection
- One-click training with SSE real-time progress (Epoch / Loss / mAP)
- Download trained `.pt` model on completion
- Training jobs and detections linked through a separate association table
- Metrics and class maps stored as JSONB
- Training dataset generation uses each detection's saved filter settings

### Model Validation

- **Dual Model Source Support**: Run inference using trained YOLO models or manually upload custom external YOLO models (`.pt` files).
- **Threshold Adjustment**: Fine-tune detection results in real time with adjustable Conf and IoU range sliders.
- **Batch Image Validation**: Run inference and visualize predictions (with bounding boxes and confidence scores) across multiple uploaded test images.
- **Real-time Video Validation Stream**:
  - Frame-by-frame live YOLO inference stream using MJPEG.
  - Interactive play/pause overlay controls with canvas-based freeze-frame capturing, ensuring smooth visual states without black screen flashes.
  - Automatic end-of-stream detection with a "Playback Completed, click to replay" blurred overlay.
  - Dedicated "Replay" footer button to bypass browser caching and restart stream validation.
  - Smooth fixed 16:9 aspect ratio container (`aspect-video`), completely eliminating container resizing or layout jumps.
- Validation results are temporary; supports exporting predictions as single-image YOLO `.txt` files.

## API Reference

All response fields use camelCase. Error responses carry correct HTTP status codes.

### Detection & Annotation

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/detect` | VLM pre-annotation (multipart) |
| GET | `/api/v1/detections` | List detections (paginated, returns `data` + `total` + `page` + `pageSize`) |
| GET | `/api/v1/detections/{id}` | Detection detail |
| GET | `/api/v1/detections/{id}/image` | Original image |
| POST | `/api/v1/detections/{id}/boxes` | Add annotation box |
| PUT | `/api/v1/detections/{id}/boxes` | Replace all boxes for a detection |
| PUT | `/api/v1/detections/{id}/boxes/{boxId}` | Update box coordinates |
| POST | `/api/v1/detections/{id}/boxes/{boxId}/delete` | Delete box |
| PUT | `/api/v1/detections/{id}/filter-settings` | Save filter mode and NMS IoU |
| POST | `/api/v1/detections/{id}/delete` | Delete detection |
| GET | `/api/v1/detections/{id}/export` | Export single YOLO label |
| POST | `/api/v1/detections/export-batch` | Batch export (zip) |

### Video

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/videos/upload` | Upload video (multipart) |
| GET | `/api/v1/videos` | List videos (paginated) |
| GET | `/api/v1/videos/{id}` | Video detail (includes keyframes) |
| POST | `/api/v1/videos/{id}/extract-keyframes` | Extract keyframes |
| GET | `/api/v1/videos/{id}/keyframes/{keyframeId}/image` | Keyframe image |
| POST | `/api/v1/videos/{id}/delete` | Delete video and keyframes |

### Training

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/train/jobs` | Create training job (supports trainRatio/valRatio split, taskType) |
| GET | `/api/v1/train/jobs` | List training jobs (paginated) |
| GET | `/api/v1/train/variants` | Available YOLO series |
| GET | `/api/v1/train/jobs/{id}/progress/stream` | SSE training progress |
| GET | `/api/v1/train/jobs/{id}/download` | Download PT model |
| GET | `/api/v1/train/jobs/{id}/dataset` | Download dataset zip (images + labels + data.yaml) |
| GET | `/api/v1/train/jobs/{id}/charts/{name}` | Training charts (results.png, etc.) |
| POST | `/api/v1/train/jobs/{id}/export-onnx` | Export / download ONNX model |
| POST | `/api/v1/train/jobs/{id}/predict` | YOLO model inference |
| POST | `/api/v1/train/jobs/{id}/delete` | Delete training job |
| POST | `/api/v1/train/upload-model` | Upload external YOLO model (.pt) to get a Token |
| POST | `/api/v1/train/validate-image/{token}` | Validate image using external model |
| GET | `/api/v1/train/validate-mjpeg/{token}/{video_id}` | Validate video using external model (MJPEG live stream) |

### Response Format

**Success (single)** → `200/201`:
```json
{ "data": { "id": "...", "fileName": "...", "createdAt": "..." } }
```

**Success (list)** → `200`:
```json
{ "data": [...], "total": 100, "page": 1, "pageSize": 20 }
```

**Success (delete)** → `204` (empty body)

**Error** → `4xx/5xx`:
```json
{ "error": { "code": "NotFoundError", "message": "Video not found: xxx" } }
```

## Cross-Platform

| Platform | Inference | Training |
|----------|-----------|----------|
| macOS (Apple Silicon) | MPS | MPS |
| Linux / Windows (NVIDIA) | CUDA | CUDA |
| No GPU | CPU | CPU |

Auto-detection priority: CUDA → MPS → CPU. Override via `DEVICE` env variable.

## Development Checks

```bash
# Frontend
cd frontend
pnpm install
pnpm run lint
pnpm run build

# Backend
cd backend
source .venv/bin/activate
PYTHONPATH=. alembic upgrade head
python -m compileall app alembic
```

## License

Code: [MIT](LICENSE).

LocateAnything-3B model: [NVIDIA License](https://huggingface.co/nvidia/LocateAnything-3B/blob/main/LICENSE) (non-commercial use only).
