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
| Node.js | 20+ |
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

# Frontend
cd ../frontend
npm install

# Database
psql -d postgres -c "CREATE DATABASE locate_anything;"

# Config
cp backend/.env.example backend/.env
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

### History Management

- Thumbnail previews with category tags
- Multi-select tag filtering
- Click to view details, re-detect with updated labels
- Export single or batch YOLO format labels

### YOLO Training

- Multi-series: YOLOv5 / v8 / v11 / v26 (n/s/m/l/x)
- Tag filter + thumbnail preview for precise training data selection
- One-click training with SSE real-time progress (Epoch / Loss / mAP)
- Download trained `.pt` model on completion

### Model Validation

- Run inference with trained YOLO model on new images
- Adjustable Conf / IoU thresholds
- Visualize detections with confidence scores

## API Reference

### Detection & Annotation

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/detect` | VLM pre-annotation (multipart) |
| GET | `/api/v1/detections` | List detections (paginated) |
| GET | `/api/v1/detections/{id}` | Detection detail |
| GET | `/api/v1/detections/{id}/image` | Original image |
| POST | `/api/v1/detections/{id}/boxes` | Add annotation box |
| PUT | `/api/v1/detections/{id}/boxes/{box_id}` | Update box coordinates |
| POST | `/api/v1/detections/{id}/boxes/{box_id}/delete` | Delete box |
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

## License

Code: [MIT](LICENSE).

LocateAnything-3B model: [NVIDIA License](https://huggingface.co/nvidia/LocateAnything-3B/blob/main/LICENSE) (non-commercial use only).
