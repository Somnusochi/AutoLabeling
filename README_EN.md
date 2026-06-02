# AutoLabeling

[中文文档](README.md) | English

End-to-end **pre-annotation & training system** powered by NVIDIA LocateAnything-3B VLM.

> Images in, model out — VLM auto-labeling + manual refinement + one-click YOLO training + validation.

**Pipeline**: VLM Pre-annotation → Manual Refinement → Export Dataset → Train YOLO → Validate Model

## Screenshots

| VLM Pre-annotation | Manual Annotation & Training |
|-------------------|---------------------------|
| ![Pre-annotation](docs/1.png) | ![Training](docs/2.png) |

| Model Validation |
|-----------------|
| ![Validation](docs/3.png) |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Visual Grounding | NVIDIA LocateAnything-3B (Qwen2.5-3B + MoonViT) |
| Object Detection | YOLOv5 / v8 / v11 / v26 (Ultralytics) |
| Backend | Python FastAPI + PostgreSQL + SSE |
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| State Management | TanStack Query + ahooks |
| Tooling | unplugin-auto-import, ESLint, Prettier |

## Quick Start

### Requirements

| Resource | Minimum |
|----------|---------|
| Python | 3.12+ |
| Node.js | 22+ |
| PostgreSQL | 16+ |
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
npm install
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

## Features

### VLM Pre-annotation

Upload images with open-vocabulary descriptions (e.g. `fire, smoke`, `red car`). LocateAnything-3B automatically detects and draws bounding boxes.

- Open-vocabulary: describe anything in natural language
- Auto-resize large images to prevent OOM
- Batch upload: drag a folder, process serially

### Manual Annotation

Canvas drawing mode for precise box annotation.

- Toggle between View / Draw modes
- Category quick-fill from history
- VLM pre-annotation as baseline → delete mistakes → fill gaps
- Filter boxes with All / Best / NMS modes
- Saved filter settings are applied by backend export and training dataset generation
- Temporarily hide individual boxes while inspecting dense detections

### History Management

- Thumbnail previews with category tags
- Multi-select tag filtering
- Click to view details, re-detect with updated labels
- Export single or batch YOLO format labels
- Single-image `.txt` export runs in the browser; batch export uses backend zip generation

### YOLO Training

- Multi-series: YOLOv5 / v8 / v11 / v26 (n/s/m/l/x)
- Tag filter + thumbnail preview for precise training data selection
- One-click training with SSE real-time progress (Epoch / Loss / mAP)
- Download trained `.pt` model on completion
- Training jobs and detections are linked through a separate association table
- Metrics and class maps are stored as JSONB
- Training dataset generation uses each detection's saved filter settings

### Model Validation

- Run inference with trained YOLO model on new images
- Adjustable Conf / IoU thresholds
- Visualize detections with confidence scores
- Validation results are temporary: they can export a single YOLO `.txt`, but do not save filter settings or request backend zip export

## API Reference

### Detection & Annotation

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/detect` | VLM pre-annotation (multipart) |
| GET | `/api/v1/detections` | List detections (paginated) |
| GET | `/api/v1/detections/{id}` | Detection detail |
| GET | `/api/v1/detections/{id}/image` | Original image |
| POST | `/api/v1/detections/{id}/boxes` | Add annotation box |
| PUT | `/api/v1/detections/{id}/boxes` | Replace all boxes for a detection |
| PUT | `/api/v1/detections/{id}/boxes/{box_id}` | Update box coordinates |
| POST | `/api/v1/detections/{id}/boxes/{box_id}/delete` | Delete box |
| PUT | `/api/v1/detections/{id}/filter-settings` | Save filter mode and NMS IoU |
| POST | `/api/v1/detections/{id}/delete` | Delete detection |
| GET | `/api/v1/detections/{id}/export` | Export single YOLO label |
| POST | `/api/v1/detections/export-batch` | Batch export (zip) |

### Training

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/train/jobs` | Create training job |
| GET | `/api/v1/train/jobs` | List training jobs |
| GET | `/api/v1/train/variants` | Available YOLO series |
| GET | `/api/v1/train/jobs/{id}/progress/stream` | SSE training progress |
| POST | `/api/v1/train/jobs/{id}/predict` | YOLO model inference |
| POST | `/api/v1/train/jobs/{id}/delete` | Delete training job |

## Cross-Platform

| Platform | Inference | Training |
|----------|-----------|----------|
| macOS (Apple Silicon) | MPS | MPS |
| Linux / Windows (NVIDIA) | CUDA | CUDA |
| No GPU | CPU | CPU |

Auto-detection priority: CUDA → MPS → CPU. Override via `DEVICE` env variable.

## Development Checks

The frontend depends on Vite/Rolldown native bindings, so the Node architecture must match the installed `node_modules`. If you changed Node architecture or removed a stale Node install, reinstall dependencies:

```bash
cd frontend
npm install
npm run lint
npm run build
```

Backend checks:

```bash
cd backend
source .venv/bin/activate
PYTHONPATH=. alembic upgrade head
python -m compileall app alembic
```

## License

Code: [MIT](LICENSE).

LocateAnything-3B model: [NVIDIA License](https://huggingface.co/nvidia/LocateAnything-3B/blob/main/LICENSE) (non-commercial use only).
