# VLM-AutoYOLO

[简体中文](README_ZH.md) | English

**End-to-end object detection auto-labeling and YOLO training platform.** VLM-powered annotation (NVIDIA LocateAnything-3B), SAM2.1 mask refinement, manual annotation, multi-format dataset export, one-click YOLO training (detect & segment), video keyframe extraction, and model validation.

> Images in, model out — VLM auto-labeling → SAM2 mask refinement → manual refinement → multi-format export → YOLO training → validation.

**Full pipeline**: VLM Pre-annotation → SAM2 Segmentation → Manual Refinement → Multi-format Export → YOLO Training (Detect / Segment) → Model Validation

**Key features**:
- 🤖 **VLM auto-labeling**: Open-vocabulary object detection with LocateAnything-3B
- 🎯 **SAM2 segmentation**: Bbox → pixel-precise mask with SAM 2.1, BBox/Mask toggle on canvas
- 🎥 **Video annotation**: Intelligent keyframe extraction (scene / motion / interval), SSIM dedup
- ✏️ **Manual refinement**: Canvas draw mode, NMS filtering, hide/show individual boxes
- 📦 **Multi-format export**: YOLO, YOLO-Seg, COCO JSON, Pascal VOC XML, CreateML JSON
- 🚀 **One-click training**: YOLOv8 / v11 / v26, detect & segment, real-time SSE progress
- ✅ **Model validation**: Batch image / video testing, MJPEG live stream, SSE video inference
- 💾 **Smart model management**: Lazy loading, idle auto-unload, MPS/CUDA strategy pattern cleanup
- 🌐 **i18n**: English / 简体中文 · 🎨 **Theme**: Light / dark mode

## Documentation

📚 **[User Guide (English)](docs/guide/en/README.md)** | 📚 **[用户指南 (中文)](docs/guide/README.md)**

Comprehensive guides: quick start, annotation best practices, training parameter tuning, model deployment.

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
| Segmentation | SAM 2.1 — Segment Anything Model 2 |
| Object Detection | YOLOv8 / v11 / v26 — Detect & Segment (Ultralytics) |
| Backend | Python FastAPI + PostgreSQL + SSE |
| Frontend | React + TypeScript + Vite + Tailwind CSS + antd |
| GPU Memory | Strategy Pattern (`gpu_memory.py`) — CUDA expandable segments / MPS synchronize + empty_cache |
| State | TanStack Query + ahooks |
| i18n | i18next (English / 简体中文) |
| Video | ffmpeg (scene / motion / interval extraction) |
| Tooling | pnpm, ESLint, Prettier |

## Quick Start

### Docker Deployment

> **Requirements:** Linux or Windows (WSL2) with NVIDIA GPU + [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html).
> **macOS is not supported** — Docker on Mac has no GPU passthrough. Use [Manual Setup](#manual-setup) instead.

**Quick start with pre-built images:**

```bash
curl -O https://raw.githubusercontent.com/Somnusochi/VLM-AutoYOLO/master/docker-compose.yml
docker compose up -d
open http://localhost        # Frontend
open http://localhost:8000/docs  # API docs
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
| Frontend | 80 | React web UI (Nginx) |
| Backend | 8000 | FastAPI server |
| Database | 5432 | PostgreSQL |

**GPU Support** — add to `docker-compose.yml`:

```yaml
backend:
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

**Persistent Storage (Docker volumes):**
- `pgdata` — Database · `model-cache` — VLM & SAM2 models · `uploads` — User images/videos · `training-data` — YOLO training outputs

**Backup / Restore:**

```bash
docker compose exec db pg_dump -U postgres autolabeling > backup.sql
cat backup.sql | docker compose exec -T db psql -U postgres autolabeling
```

### Manual Setup

**Requirements:**

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| Python | 3.12+ | 3.12+ |
| Node.js | 22+ | 22+ |
| PostgreSQL | 16+ | 16+ |
| ffmpeg | Any | — |
| macOS | Apple Silicon 16GB | 24GB+ |
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

# Database (PostgreSQL recommended, but SQLite is supported out of the box)
# If using PostgreSQL:
# psql -d postgres -c "CREATE DATABASE autolabeling;"
# cp backend/.env.example backend/.env
# If you prefer a zero-setup SQLite database, just skip the two steps above. The system will auto-generate autolabeling.db

# Migrations
cd backend
PYTHONPATH=. alembic upgrade head
```

**Pre-download models (optional):**

```bash
huggingface-cli download nvidia/LocateAnything-3B --local-dir backend/model
```

**Launch:**

```bash
./start.sh   # macOS / Linux
start.bat    # Windows
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
│   │   │   └── routes/
│   │   │       ├── detection.py     # Detection CRUD, manual annotation, model mgmt
│   │   │       ├── export.py        # Multi-format dataset export
│   │   │       ├── predict.py       # Model validation, video inference (MJPEG/SSE)
│   │   │       ├── train.py         # YOLO training, SSE progress, retrain
│   │   │       └── video.py         # Video upload, keyframe extraction
│   │   ├── core/
│   │   │   ├── config.py            # Settings, device auto-detect, allocator tuning
│   │   │   ├── database.py          # SQLAlchemy engine + session
│   │   │   ├── gpu_memory.py        # GPU memory strategy (CUDA / MPS / CPU)
│   │   │   └── ...
│   │   ├── models/                  # SQLAlchemy ORM
│   │   │   ├── detection.py         # Detection & bounding boxes (incl. mask_polygon)
│   │   │   ├── train.py             # Training jobs (detect & segment)
│   │   │   └── video.py             # Videos & keyframes
│   │   ├── repositories/            # Data access layer
│   │   ├── schemas/                 # Pydantic models (camelCase)
│   │   ├── services/
│   │   │   ├── box_filter.py        # Box filtering, NMS dedup
│   │   │   ├── locate_anything.py   # VLM inference engine
│   │   │   ├── sam2_service.py      # SAM2 segmentation service
│   │   │   ├── trainer.py           # YOLO training + validation
│   │   │   ├── export.py            # Multi-format export dispatcher
│   │   │   ├── yolo_format.py       # YOLO label conversion (bbox + seg)
│   │   │   ├── coco_format.py       # COCO JSON exporter
│   │   │   ├── voc_format.py        # Pascal VOC XML exporter
│   │   │   ├── createml_format.py   # CreateML JSON exporter
│   │   │   ├── video_service.py     # ffmpeg keyframe extraction + SSIM dedup
│   │   │   └── frame_utils.py       # Frame prediction & annotation drawing
│   │   └── main.py                  # FastAPI entry point
│   ├── alembic/                     # Database migrations
│   ├── requirements.txt
│   └── pyproject.toml
├── frontend/
│   └── src/
│       ├── components/              # React UI components
│       │   ├── DetectionCanvas.tsx  # Image annotation canvas (bbox + mask)
│       │   ├── DetectionResult.tsx  # Detection result with multi-format export
│       │   ├── TrainingPanel.tsx    # YOLO training (detect & segment, dataset download)
│       │   ├── HistoryList.tsx      # Detection history (paginated, export)
│       │   ├── HistoryListItem.tsx  # Individual history item card
│       │   ├── ResultTable.tsx      # Results table with mask column
│       │   ├── training/            # YOLO training sub-components
│       │   │   ├── TrainingCandidateList.tsx
│       │   │   ├── CandidateListItem.tsx
│       │   │   ├── TrainingJobItem.tsx
│       │   │   ├── TrainingPreview.tsx
│       │   │   └── StatusBadge.tsx
│       │   ├── Sidebar.tsx          # Main sidebar (SAM2 toggle, detect, train)
│       │   ├── VideoPanel.tsx       # Video upload & keyframe timeline
│       │   ├── VideoValidator.tsx   # Video validation
│       │   ├── ModelSelector.tsx    # YOLO model variant selector
│       │   ├── ValidationSettings.tsx # Conf/IoU threshold controls
│       │   ├── ImageUploader.tsx    # Drag-and-drop image upload
│       │   ├── CategoryInput.tsx    # Category quick-fill input
│       │   ├── FilterPanel.tsx      # Filter mode selector
│       │   ├── BatchProgress.tsx    # Batch annotation progress
│       │   ├── KeyframeGrid.tsx     # Video keyframe grid
│       │   ├── ThemeProvider.tsx    # Light/dark theme
│       │   ├── Layout.tsx           # App layout
│       │   └── ...
│       ├── pages/Home.tsx           # Main page
│       ├── hooks/                   # Custom hooks (useHomeState, useBatchDetection, ...)
│       ├── i18n/locales/            # en.json, zh.json
│       ├── services/api.ts          # Unified API layer
│       ├── lib/                     # Constants, filters, parsers, yoloExport
│       └── types/index.ts           # TypeScript types (BBox, Detection, TrainingJob)
├── docs/                            # Screenshots & user guides
├── docker-compose.yml
├── start.sh / start.bat
└── README.md
```

## Features

### VLM Pre-annotation

Upload images or video keyframes with open-vocabulary descriptions (e.g. `fire, smoke`, `red car`). LocateAnything-3B automatically detects and draws bounding boxes.

- Open-vocabulary natural language descriptions
- Auto-resize by long-side cap (VRAM-based: 800–1333px)
- Batch upload folders or video keyframes, streaming results

### SAM2 Segmentation

Enable SAM2 (Segment Anything Model 2) to refine VLM bounding boxes into pixel-precise masks.

- Check "Enable SAM2 Segmentation" before detection — runs automatically after VLM
- SAM 2.1 model (base+), lazy-loaded with idle auto-unload
- Masks rendered as semi-transparent overlays on canvas
- BBox and Mask independently toggled on both main canvas and hover preview
- Result table shows polygon vertex count per box

### Video Annotation

Upload a video, extract keyframes, select and batch-annotate.

- **Three extraction modes**: scene change, motion detection (optical flow), fixed interval
- **SSIM deduplication**: auto-removes near-duplicate frames
- **Timeline preview**: horizontal scrollable strip, click for full-size view
- **Multi-select**: check frames, select/cancel all, load to annotation queue

### Manual Annotation

Canvas-based annotation with View / Draw modes.

- Category quick-fill from history
- VLM pre-annotation baseline → delete mistakes → draw missing boxes
- All / Best / NMS filter modes, settings saved per detection
- Hide individual boxes while inspecting dense results
- Per-frame re-detection

### History Management

- Thumbnail + category tag previews, tag-based multi-select filtering
- Click to view details, re-detect with updated labels, frontend pagination
- Single / batch export in **5 formats**: YOLO, YOLO-Seg, COCO JSON, Pascal VOC XML, CreateML JSON
- Format selection via dropdown menu, one-click zip download

### YOLO Training

- **Series**: YOLOv8 / v11 / v26 (n/s/m/l/x)
- **Task types**: Object Detection (Detect), Instance Segmentation (Segment)
- Segmentation training auto-uses SAM2 polygon labels; falls back to bbox when unavailable
- Tag filter + thumbnail preview for precise data selection
- Dataset split presets (70/20/10, 80/20, 90/10, 60/20/20)
- Real-time SSE progress: Epoch / Loss / mAP50
- Auto ONNX export; download PT / ONNX / dataset zip

### Model Validation

- **Dual source**: trained models or externally uploaded `.pt` files
- **Conf / IoU sliders** for real-time threshold tuning
- **Batch image validation** with bounding boxes and confidence scores
- **Video validation** (three modes):
  - MJPEG live stream with interactive play/pause
  - SSE prediction stream with per-frame JSON events
  - Sync batch prediction — all frames at once
- Temporary results; export predictions as YOLO `.txt` files

### Model Management

- **Lazy loading**: VLM and SAM2 load on first use, unload after idle (default 10 min)
- **Idle watchdog**: configurable via `MODEL_IDLE_TIMEOUT_SECONDS`
- **Status / unload API**: `GET /api/v1/model/status`, `POST /api/v1/model/unload`
- **GPU memory**: Strategy Pattern (`gpu_memory.py`) — CUDA `expandable_segments` / MPS `synchronize`+`empty_cache`+`gc`

## API Reference

All fields camelCase. Errors carry correct HTTP status codes.

### Detection & Annotation

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/detect` | VLM pre-annotation (multipart, supports `use_sam2` flag) |
| GET | `/api/v1/detections` | List detections (paginated) |
| GET | `/api/v1/detections/{id}` | Detection detail |
| GET | `/api/v1/detections/{id}/image` | Original image |
| POST | `/api/v1/detections/{id}/boxes` | Add annotation box |
| PUT | `/api/v1/detections/{id}/boxes` | Replace all boxes |
| PUT | `/api/v1/detections/{id}/boxes/{boxId}` | Update box coordinates |
| POST | `/api/v1/detections/{id}/boxes/{boxId}/delete` | Delete box |
| PUT | `/api/v1/detections/{id}/filter-settings` | Save filter mode & NMS IoU |
| POST | `/api/v1/detections/{id}/delete` | Delete detection |
| GET | `/api/v1/detections/{id}/export` | Export single YOLO label |
| POST | `/api/v1/detections/export-batch` | Multi-format export: `yolo` `yolo-seg` `coco` `voc` `createml` (zip) |
| GET | `/api/v1/model/status` | VLM model status |
| POST | `/api/v1/model/unload` | Unload VLM model |

### Video

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/videos/upload` | Upload video |
| GET | `/api/v1/videos` | List videos (paginated) |
| GET | `/api/v1/videos/{id}` | Video detail (includes keyframes) |
| GET | `/api/v1/videos/{id}/file` | Video file download |
| POST | `/api/v1/videos/{id}/extract-keyframes` | Extract keyframes |
| GET | `/api/v1/videos/{id}/keyframes/{keyframeId}/image` | Keyframe image |
| POST | `/api/v1/videos/{id}/delete` | Delete video and keyframes |

### Training

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/train/jobs` | Create training job (detect / segment, train/val split) |
| GET | `/api/v1/train/jobs` | List training jobs (paginated) |
| GET | `/api/v1/train/variants` | Available YOLO series |
| GET | `/api/v1/train/jobs/{id}/progress/stream` | SSE training progress |
| GET | `/api/v1/train/jobs/{id}/download` | Download PT model |
| GET | `/api/v1/train/jobs/{id}/dataset` | Download dataset zip |
| GET | `/api/v1/train/jobs/{id}/charts/{name}` | Training charts |
| POST | `/api/v1/train/jobs/{id}/export-onnx` | Export ONNX model |
| POST | `/api/v1/train/jobs/{id}/predict` | YOLO inference (image) |
| POST | `/api/v1/train/jobs/{id}/retrain` | Re-run with same settings |
| GET | `/api/v1/train/jobs/{id}/validate-mjpeg/{video_id}` | Validate video (MJPEG) |
| POST | `/api/v1/train/jobs/{id}/predict-video-stream` | Validate video (SSE) |
| POST | `/api/v1/train/jobs/{id}/predict-video` | Validate video (sync batch) |
| POST | `/api/v1/train/jobs/{id}/delete` | Delete training job |
| POST | `/api/v1/train/upload-model` | Upload external model (.pt) |
| POST | `/api/v1/train/validate-image/{token}` | Validate with external model |
| GET | `/api/v1/train/validate-mjpeg/{token}/{video_id}` | Validate video with external model (MJPEG) |

### Response Format

```json
{ "data": { ... } }                                    // Single: 200/201
{ "data": [...], "total": 100, "page": 1, "pageSize": 20 }  // List: 200
// Delete: 204 (empty body)
{ "error": { "code": "NotFoundError", "message": "..." } }   // Error: 4xx/5xx
```

## Cross-Platform

| Platform | Inference | Training |
|----------|-----------|----------|
| macOS (Apple Silicon) | MPS | MPS |
| Linux / Windows (NVIDIA) | CUDA | CUDA |

Auto-detection: CUDA → MPS. Override via `DEVICE` env. **CPU not supported.**

## Inference Benchmarks

### Windows 11 + RTX 3080 10GB (CUDA)

7 cat images, 3 rounds each, `max_new_tokens=512`, long side 800px.

| Mode | Image Size | Avg Time | Stable Avg* |
|------|-----------|----------|-------------|
| VLM only | Large (800×640) | 1.0s | **1.0s** |
| VLM only | Thumbnails | 367ms | **367ms** |
| VLM + SAM2 | Large (800×640) | 3.4s | **3.4s** |
| VLM + SAM2 | Thumbnails | 475ms | **475ms** |

> *Excludes first image of Round 1 (model loading ~22s). **VRAM**: ~5.5GB loaded, ~7.5GB peak.

### macOS Apple Silicon 24GB (MPS)

13 cat images, 3 rounds each, `max_new_tokens=512`, long side 1024px.

| Mode | Cold Start | Warm (R2) | Warm (R3) | Warm Avg |
|------|-----------|-----------|-----------|----------|
| VLM + SAM2 | 13.8s | 4.9s | 4.9s | **4.9s/img** |
| VLM only | 3.7s | 4.3s | 4.3s | **4.3s/img** |

> Cold start includes VLM + SAM2 model loading (~14s). SAM2 overhead: +0.65s (15%). Masks: 13/13.
> **Memory**: 9.8–13GB stable across 6 rounds with MPS cleanup after each detection.

## Highlights

- **MPS / CUDA full-pipeline GPU acceleration** — VLM, SAM2, and YOLO training all GPU-accelerated
- **Strategy Pattern GPU memory** — `gpu_memory.py` centralizes CUDA / MPS cleanup; `expandable_segments:True`
- **SAM2 mask refinement** — pixel-precise polygons from bounding boxes, BBox/Mask independent toggle
- **5 export formats** — YOLO, YOLO-Seg, COCO, Pascal VOC, CreateML
- **Detect & Segment training** — polygon labels auto-used when SAM2 masks are available
- **Cross-platform** — macOS MPS, Windows / Linux CUDA, unified codebase
- **Smart model lifecycle** — lazy loading, idle auto-unload, background download with progress

## Development

```bash
# Frontend
cd frontend && pnpm install && pnpm run lint && pnpm run build

# Backend
cd backend && source .venv/bin/activate
PYTHONPATH=. alembic upgrade head
python -m compileall app alembic
```

## License

Code: [MIT](LICENSE). LocateAnything-3B model: [NVIDIA License](https://huggingface.co/nvidia/LocateAnything-3B/blob/main/LICENSE) (non-commercial use only).
