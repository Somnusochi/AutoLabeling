# Inference Benchmarks

## Windows 11 + RTX 3080 10GB (CUDA)

7 cat images, 3 rounds each, `max_new_tokens=512`, long side 800px.

| Mode | Image Size | Avg Time | Stable Avg* |
|------|-----------|----------|-------------|
| VLM only | Large (800×640) | 1.0s | **1.0s** |
| VLM only | Thumbnails | 367ms | **367ms** |
| VLM + SAM2 | Large (800×640) | 3.4s | **3.4s** |
| VLM + SAM2 | Thumbnails | 475ms | **475ms** |

> *Excludes first image of Round 1 (model loading ~22s).

**VRAM**: VLM ~5.5GB loaded; peak ~7.5GB during inference. 10GB GPUs are comfortable.

## macOS Apple Silicon 24GB (MPS)

13 cat images, 3 rounds each, `max_new_tokens=512`, long side 1024px.

| Mode | Cold Start | Warm (R2) | Warm (R3) | Warm Avg |
|------|-----------|-----------|-----------|----------|
| VLM + SAM2 | 13.8s | 4.9s | 4.9s | **4.9s/img** |
| VLM only | 3.7s | 4.3s | 4.3s | **4.3s/img** |

> Cold start includes VLM + SAM2 model loading (~14s). SAM2 overhead: +0.65s (15%). Masks: 13/13.

**Memory**: 9.8–13GB stable across 6 rounds with MPS cleanup after each detection.

## Configuration

- **Long-side cap**: auto-selected by GPU VRAM (<12GB → 800px, 12–16GB → 1024px, ≥16GB → 1333px; MPS → 1024px)
- **GPU memory**: `gpu_memory.py` Strategy Pattern — `expandable_segments:True` (CUDA), `synchronize`+`empty_cache`+`gc` (MPS)
- **Model**: `facebook/sam2.1-hiera-base-plus`
