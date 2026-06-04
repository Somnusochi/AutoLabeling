# VLM-AutoYOLO

[简体中文](README_ZH.md) | English

**End-to-end object detection auto-labeling and YOLO training platform.** VLM-powered data annotation with NVIDIA LocateAnything-3B, SAM2.1 mask refinement, manual refinement, one-click YOLO training (detect & segment), multi-format dataset export, video keyframe extraction, and model validation.

> Images in, model out — VLM auto-labeling → SAM2 mask refinement → manual refinement → export → YOLO training → validation.

**Complete computer vision pipeline**: VLM Pre-annotation → SAM2 Segmentation → Manual Refinement → Multi-format Export → Train YOLO (Detect / Segment) → Validate Model

**Key features**:
- 🤖 **VLM auto-labeling**: Open-vocabulary object detection with LocateAnything-3B
- 🎯 **SAM2 segmentation**: Bbox → pixel-precise mask refinement with SAM 2.1
- 🎥 **Video annotation**: Intelligent keyframe extraction (scene/motion/interval detection)
- ✏️ **Manual refinement**: Canvas-based annotation with NMS filtering, BBox/Mask toggle
- 🚀 **One-click training**: YOLOv8/v11/v26 (detect & segment), real-time SSE progress
- 📦 **Multi-format export**: YOLO, YOLO-Seg, COCO JSON, Pascal VOC XML, CreateML JSON
- ✅ **Model validation**: Batch image/video testing, real-time MJPEG and SSE video inference
- 🌐 **i18n**: English / 简体中文 interface
- 🎨 **Theme**: Light / dark mode with system preference detection

## Documentation

📚 **[User Guide (English)](docs/guide/en/README.md)** | 📚 **[用户指南 (中文)](docs/guide/README.md)**

Comprehensive guides covering:
- Quick start tutorial
- Annotation best practices
- Training parameter tuning
- Model optimization and deployment

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
| Segmentation | SAM 2.1 (Segment Anything Model 2) |
| Object Detection | YOLOv8 / v11 / v26 — Detect & Segment (Ultralytics) |
| Backend | Python FastAPI + PostgreSQL + SSE |
| Frontend | React + TypeScript + Vite + Tailwind CSS + antd |
| State Management | TanStack Query + ahooks |
| i18n | i18next (English / 简体中文) |
| Video Processing | ffmpeg (scene detection / motion detection / interval extraction) |
| Tooling | pnpm, ESLint, Prettier |

## Quick Start

### Docker Deployment

> **Requirements:** Linux or Windows (WSL2) with NVIDIA GPU + [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html).
> **macOS is not supported** — Docker on Mac has no GPU passthrough. Please use [Manual Setup](#manual-setup) instead.

**Quick start with pre-built images:**

```bash
# Download docker-compose.yml
curl -O https://raw.githubusercontent.com/Somnusochi/VLM-AutoYOLO/master/docker-compose.yml

# Start all services
docker compose up -d

# Access the application
open http://localhost  # Frontend
open http://localhost:8000/docs  # API documentation
```

**Build from source:**

```bash
git clone https://github.com/Somnusochi/VLM-AutoYOLO.git
cd VLM-AutoYOLO
docker compose up -d --build
```

**Services:**

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 80 | React web interface (Nginx) |
| Backend | 8000 | FastAPI server |
| Database | 5432 | PostgreSQL |

**GPU Support:**

For NVIDIA GPU acceleration, edit `docker-compose.yml` and add GPU configuration to the backend service:

```yaml
backend:
  # ... other config ...
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
  environment:
    DEVICE: cuda
```

**Persistent Storage:**

Docker volumes are used for:
- `pgdata`: Database data
- `model-cache`: Downloaded VLM and SAM2 models
- `uploads`: User uploaded images/videos
- `training-data`: YOLO training runs and outputs

To backup data:
```bash
docker compose exec db pg_dump -U postgres autolabeling > backup.sql
```

To restore:
```bash
cat backup.sql | docker compose exec -T db psql -U postgres autolabeling
```

**Logs:**
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
```

### Manual Setup

If you prefer not to use Docker, follow these steps:

**Requirements:**

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| Python | 3.12+ | 3.12+ |
| Node.js | 22+ | 22+ |
| PostgreSQL | 16+ | 16+ |
| ffmpeg | Any version | — |
| macOS | Apple Silicon 24GB unified memory | 24GB+ |
| NVIDIA GPU | 10GB VRAM | 12GB+ |

**Setup:**

```bash
git clone https://github.com/Somnusochi/VLM-AutoYOLO.git
cd VLM-AutoYOLO

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

**Model Download (Optional):**

```bash
# Auto-downloaded on first run. Pre-download if network is slow:
huggingface-cli download nvidia/LocateAnything-3B --local-dir backend/model
```

**Launch:**

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

## Project Structure

```
VLM-AutoYOLO/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py              # Dependency injection
│   │   │   └── routes/              # REST API
│   │   │       ├── detection.py     # Detection CRUD, manual annotation, model management
│   │   │       ├── export.py        # YOLO format export
│   │   │       ├── predict.py       # Model validation, video inference (MJPEG/SSE)
│   │   │       ├── train.py         # Training, SSE, retrain
│   │   │       └── video.py         # Video upload, keyframe extraction
│   │   ├── core/                    # Config, database, middleware, logging, exceptions
│   │   ├── models/                  # SQLAlchemy ORM
│   │   │   ├── detection.py         # Detection & bounding boxes
│   │   │   ├── train.py             # Training jobs
│   │   │   └── video.py             # Video & keyframes
│   │   ├── repositories/            # Data access layer
│   │   ├── schemas/                 # Pydantic models (camelCase)
│   │   ├── services/
│   │   │   ├── box_filter.py        # Box filtering, NMS dedup
│   │   │   ├── frame_utils.py       # Frame prediction & annotation drawing
│   │   │   ├── locate_anything.py   # VLM inference engine
│   │   │   ├── sam2_service.py      # SAM2 segmentation service
│   │   │   ├── video_service.py     # ffmpeg keyframe extraction + SSIM dedup
│   │   │   ├── trainer.py           # YOLO training + validation
│   │   │   ├── export.py            # Multi-format annotation export
│   │   │   ├── yolo_format.py       # YOLO format conversion (bbox + seg)
│   │   │   ├── coco_format.py       # COCO JSON export
│   │   │   ├── voc_format.py        # Pascal VOC XML export
│   │   │   └── createml_format.py   # CreateML JSON export
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
│       │   ├── VideoValidator.tsx   # Video validation with trained model
│       │   ├── KeyframeGrid.tsx     # Keyframe grid
│       │   ├── TrainingPanel.tsx    # YOLO training panel
│       │   ├── HistoryList.tsx      # Detection history list
│       │   ├── FilterPanel.tsx      # Category & tag filter panel
│       │   ├── ImageUploader.tsx    # Image upload with drag-and-drop
│       │   ├── ModelSelector.tsx    # YOLO model variant selector
│       │   ├── BatchProgress.tsx    # Batch annotation progress
│       │   ├── CategoryInput.tsx    # Category quick-fill input
│       │   ├── ResultTable.tsx      # Detection result table
│       │   ├── ValidationSettings.tsx # Conf/IoU threshold controls
│       │   ├── Layout.tsx           # App layout wrapper
│       │   ├── Sidebar.tsx          # Navigation sidebar
│       │   ├── ThemeProvider.tsx     # Light/dark theme provider
│       │   ├── ErrorBoundary.tsx    # React error boundary
│       │   ├── LoadingSkeleton.tsx  # Loading skeleton placeholders
│       │   └── ...
│       ├── pages/
│       │   └── Home.tsx             # Main page (image/video dual mode)
│       ├── hooks/                   # Custom hooks
│       │   ├── useDetection.ts      # Detection state & actions
│       │   ├── useBatchDetection.ts # Batch detection orchestration
│       │   ├── useHomeState.ts      # Home page state management
│       │   ├── useTheme.tsx         # Theme toggle hook
│       │   └── useYoloValidation.ts # Validation state & streaming
│       ├── i18n/                    # Internationalization
│       │   ├── config.ts            # i18next configuration
│       │   └── locales/             # en.json, zh.json
│       ├── services/
│       │   ├── api.ts               # Unified API layer (camelCase)
│       │   └── request.ts           # HTTP client wrapper
│       ├── lib/                     # Utilities
│       │   ├── constants.ts         # App constants
│       │   ├── filterBoxes.ts       # Client-side box filtering
│       │   ├── formatTime.ts        # Time formatting
│       │   ├── parsers.ts           # Response parsers
│       │   └── yoloExport.ts        # Browser-side YOLO label export
│       └── types/                   # TypeScript types
│           └── index.ts
├── docs/                            # Screenshots & user guides
│   ├── guide/                       # 中文用户指南
│   └── guide/en/                    # English user guide
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

### SAM2 Segmentation

Enable SAM2 (Segment Anything Model 2) to refine VLM bounding boxes into precise pixel-level masks.

- Toggle "Enable SAM2 Segmentation" before detection to auto-run mask generation
- SAM 2.1 model (base+ / large), lazy-loaded with auto-unload on idle
- Masks rendered as semi-transparent overlays on canvas; BBox and Mask can be toggled independently
- Result table shows polygon vertex count per object
- Hover preview popup also renders masks with independent toggle switches

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
- Export single or batch datasets in multiple formats: YOLO, YOLO Segmentation, COCO JSON, Pascal VOC XML, CreateML JSON
- Format selection via dropdown menu, download as zip
- History list refreshes in real time after saving filter results

### YOLO Training

- Multi-series: YOLOv8 / v11 / v26 (n/s/m/l/x)
- Task types: Object Detection, Instance Segmentation
- Segmentation training auto-uses SAM2 polygon labels (falls back to bbox)
- Tag filter + thumbnail preview for precise training data selection
- One-click training with SSE real-time progress (Epoch / Loss / mAP)
- Auto ONNX export; download PT / ONNX / dataset zip
- Training jobs and detections linked through a separate association table
- Metrics and class maps stored as JSONB
- Training dataset generation uses each detection's saved filter settings

### Model Validation

- **Dual Model Source Support**: Run inference using trained YOLO models or manually upload custom external YOLO models (`.pt` files).
- **Threshold Adjustment**: Fine-tune detection results in real time with adjustable Conf and IoU range sliders.
- **Batch Image Validation**: Run inference and visualize predictions (with bounding boxes and confidence scores) across multiple uploaded test images.
- **Video Validation** (three modes):
  - **MJPEG live stream** (`validate-mjpeg`): frame-by-frame annotated video stream using trained or external models, with interactive play/pause overlay and freeze-frame capturing.
  - **SSE prediction stream** (`predict-video-stream`): real-time JSON event stream with per-frame detection results, progress tracking, and metadata.
  - **Sync batch prediction** (`predict-video`): extract frames at configurable intervals, run inference, return all results at once.
- **Automatic end-of-stream detection** with a "Playback Completed, click to replay" blurred overlay.
- **Dedicated "Replay" footer button** to bypass browser caching and restart stream validation.
- **Smooth fixed 16:9 aspect ratio container** (`aspect-video`), completely eliminating container resizing or layout jumps.
- Validation results are temporary; supports exporting predictions as single-image YOLO `.txt` files.

### Model Management

- **Lazy loading**: VLM and SAM2 models load on first use, auto-unload after idle timeout
- **Idle watchdog**: defaults to 10-minute idle auto-unload (configurable via `MODEL_IDLE_TIMEOUT_SECONDS`)
- **Status check**: query whether the VLM model is loaded (`GET /api/v1/model/status`)
- **Manual unload**: free GPU memory on demand (`POST /api/v1/model/unload`)

### Retrain

- **One-click retrain**: re-run training with the exact same detection set and hyperparameters from a previous job (`POST /api/v1/train/jobs/{id}/retrain`).
- Useful for A/B comparison or recovering from a failed run without re-selecting data.

## API Reference

All response fields use camelCase. Error responses carry correct HTTP status codes.

### Detection & Annotation

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/detect` | VLM pre-annotation (multipart, supports `use_sam2` flag) |
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
| POST | `/api/v1/detections/export-batch` | Multi-format batch export: `yolo`, `yolo-seg`, `coco`, `voc`, `createml` (zip) |
| GET | `/api/v1/model/status` | VLM model loaded/unloaded status |
| POST | `/api/v1/model/unload` | Unload VLM model from memory |

### Video

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/videos/upload` | Upload video (multipart) |
| GET | `/api/v1/videos` | List videos (paginated) |
| GET | `/api/v1/videos/{id}` | Video detail (includes keyframes) |
| GET | `/api/v1/videos/{id}/file` | Video file download |
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
| POST | `/api/v1/train/jobs/{id}/predict` | YOLO model inference (image) |
| POST | `/api/v1/train/jobs/{id}/retrain` | Re-run training with same settings |
| GET | `/api/v1/train/jobs/{id}/validate-mjpeg/{video_id}` | Validate video using trained model (MJPEG live stream) |
| POST | `/api/v1/train/jobs/{id}/predict-video-stream` | Validate video using trained model (SSE stream) |
| POST | `/api/v1/train/jobs/{id}/predict-video` | Validate video using trained model (sync batch) |
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

Auto-detection priority: CUDA → MPS. Override via `DEVICE` env variable.
**CPU inference is not supported** — LocateAnything-3B requires GPU acceleration.

### Inference Benchmarks

Tested with 7 cat images, 3 rounds each, on Windows 11 + RTX 3080 10GB, `max_new_tokens=512`.
Model loaded fresh before first round (first image ~28s includes model loading).

| Mode | Image Size | Avg Time | Range | Stable Avg* |
|------|-----------|----------|-------|-------------|
| VLM only | 800×1000 (~100KB) | 6.3s | 5.1–7.3s | **5.6s** |
| VLM only | Thumbnails (~5KB) | 368ms | 355–396ms | **373ms** |
| **VLM only** | **All 7 images** | **3.8s** | 0.4–7.3s | **2.6s** |
| VLM + SAM2 | 800×1000 (~100KB) | 9.7s | 7.4–10.7s | **9.9s** |
| VLM + SAM2 | Thumbnails (~5KB) | 710ms | 465–1522ms | **484ms** |
| **VLM + SAM2** | **All 7 images** | **4.6s** | 0.5–10.7s | **4.5s** |

> *Stable Avg excludes first-round first-image (model loading) outlier.
>
> **VRAM usage**: VLM model alone ~5.5GB after loading; peak ~9.2GB during inference. With SAM2 loaded concurrently, ~9.8GB peak. 10GB cards work but leave minimal headroom — close unused GPU apps before running.
>
> **Performance note**: LocateAnything-3B generates tokens autoregressively — complex scenes take longer. Small/simple images complete in sub-second. Image resolution is auto-capped at 800×800 to control VRAM. Aggressive GPU memory cleanup (`gc.collect` + `cuda.empty_cache` + `cuda.ipc_collect`) runs after each detection to prevent fragmentation.

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

## Highlights

### MPS / CUDA Full-Pipeline GPU Acceleration

- **VLM Inference**: LocateAnything-3B enforces GPU — auto-detects CUDA / MPS, refuses to run on CPU
- **SAM2 Segmentation**: SAM 2.1 mask refinement runs on the same GPU, end-to-end acceleration
- **YOLO Training**: Ultralytics auto-enables MPS on Apple Silicon, native GPU training on macOS
- **Cross-Platform**: macOS Apple Silicon → MPS, Linux / Windows + NVIDIA → CUDA

## License

Code: [MIT](LICENSE).

LocateAnything-3B model: [NVIDIA License](https://huggingface.co/nvidia/LocateAnything-3B/blob/main/LICENSE) (non-commercial use only).
