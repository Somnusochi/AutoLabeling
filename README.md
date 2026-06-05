# VLM-AutoYOLO

[简体中文](README_ZH.md) | English

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License">
  <img src="https://img.shields.io/badge/Python-3.12+-blue" alt="Python">
  <img src="https://img.shields.io/badge/Node.js-22+-green" alt="Node.js">
  <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey" alt="Platform">
  <img src="https://img.shields.io/badge/GPU-MPS%20%7C%20CUDA-orange" alt="GPU">
  <img src="https://img.shields.io/github/stars/Somnusochi/VLM-AutoYOLO?style=social" alt="Stars">
</p>

```
🖼️ image/video → 🔍 VLM detection → 🎯 SAM2 mask → ✏️ refine → 📦 export → 🚀 YOLO → ✅ model
```

**Images or videos in → YOLO model out**, with VLM auto-labeling (LocateAnything-3B), SAM2.1 mask refinement, and human-in-the-loop correction. Multi-format export, one-click YOLO training (detect & segment), video keyframe extraction, and model validation — all GPU-accelerated on macOS MPS and Windows/Linux CUDA.

## Key Features
- 🤖 **VLM auto-labeling**: Open-vocabulary object detection with LocateAnything-3B
- 🎯 **SAM2 segmentation**: Bbox → pixel-precise mask with SAM 2.1, BBox/Mask toggle on canvas
- 🎥 **Video annotation**: Intelligent keyframe extraction (scene / motion / interval), SSIM dedup
- ✏️ **Manual refinement**: Canvas draw mode, NMS filtering, hide/show individual boxes
- 📦 **Multi-format export**: YOLO, YOLO-Seg, COCO JSON, Pascal VOC XML, CreateML JSON
- 🚀 **One-click training**: YOLOv8 / v11 / v26, detect & segment, real-time SSE progress
- ✅ **Model validation**: Batch image / video testing, MJPEG live stream, SSE video inference
- 💾 **Smart model management**: Lazy loading, idle auto-unload, MPS/CUDA strategy pattern cleanup
- 🌐 **i18n**: English / 简体中文 / 日本語 · 🎨 **Theme**: Light / dark mode

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
| i18n | i18next (English / 简体中文 / 日本語) |
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
| NVIDIA GPU | 12GB VRAM | 16GB+ |

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

Full directory tree: **[docs/STRUCTURE.md](docs/STRUCTURE.md)**

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

Full API documentation with request/response examples: **[docs/API.md](docs/API.md)**

## Cross-Platform

| Platform | Inference | Training |
|----------|-----------|----------|
| macOS (Apple Silicon) | MPS | MPS |
| Linux / Windows (NVIDIA) | CUDA | CUDA |

Auto-detection: CUDA → MPS. Override via `DEVICE` env. **CPU not supported.**

## Inference Benchmarks

Full benchmarks: **[docs/BENCHMARKS.md](docs/BENCHMARKS.md)**

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

## Stargazers

[![Star History Chart](https://api.star-history.com/svg?repos=Somnusochi/VLM-AutoYOLO&type=Date)](https://star-history.com/#Somnusochi/VLM-AutoYOLO&Date)

## License

Code: [MIT](LICENSE).

Third-party dependencies:
- LocateAnything-3B model — [NVIDIA License](https://huggingface.co/nvidia/LocateAnything-3B/blob/main/LICENSE) (non-commercial use only)
- Ultralytics YOLO — [AGPL-3.0](https://github.com/ultralytics/ultralytics/blob/main/LICENSE) (copyleft; training/deployment may trigger obligations)

---

If this project helps you, please ⭐ [star it on GitHub](https://github.com/Somnusochi/VLM-AutoYOLO). I'm open to new opportunities — reach out: somnusochi@gmail.com
