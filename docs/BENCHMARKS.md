# Inference Benchmarks

## Windows 11 + RTX 3080 10GB (CUDA)

7 cat images, 3 rounds each, `max_new_tokens=512`, auto long side 800px.

| Mode | Image Size | Cold Start (R1) | Round Details | Stable Avg (Warm) | VRAM / RAM Usage |
|------|------------|-----------------|---------------|-------------------|------------------|
| VLM only | Large (800×640) | ~22.0s* | 1.0s (Avg time) | **1.0s/img** | ~7.5GB+ (Peak) |
| VLM only | Thumbnails | 367ms | 367ms (Avg time) | **367ms/img** | ~5.5GB (Loaded) |
| VLM + SAM2 | Large (800×640) | 3.4s | 3.4s (Avg time) | **3.4s/img** | ~7.5GB+ (Peak) |
| VLM + SAM2 | Thumbnails | 475ms | 475ms (Avg time) | **475ms/img** | ~5.5GB (Loaded) |

> *Cold start includes first image of Round 1 model loading (~22s).
> **Note**: 10GB may hit the limit and throttle; 12GB+ is recommended.

## macOS MacBook Pro (M4 Pro) 24GB (MPS)

13 cat images, 4 rounds each, auto long side 1024px (Large) / 256px (Thumb).

| Mode | Image Size | Cold Start (R1 1st) | Round Details (R2/R3/R4) | Stable Avg (Warm) | System RAM Usage |
|------|------------|-----------------|-------------------------|-------------------|------------------|
| VLM only | Large (1024px) | 5.14s | 4.39s / 4.33s / 4.33s | **4.35s/img** | ~7.4GB (Peak) |
| VLM only | Thumb (256px) | 10.58s* | 0.69s / 0.68s / 0.68s | **0.68s/img** | ~7.4GB (Peak) |
| VLM + SAM2 | Large (1024px) | 5.33s | 4.96s / 5.00s / 4.96s | **4.98s/img** | ~7.8GB (Peak) |
| VLM + SAM2 | Thumb (256px) | 3.11s | 1.14s / 1.14s / 1.14s | **1.14s/img** | ~7.8GB (Peak) |

> *Full cold start includes initial model loading and MPS graph compilation. Subsequent "1st" timings are pre-warmed mode switching overhead.
> **Note**: For pure inference (thumbnails), Apple Silicon unified memory bandwidth provides immense performance (0.68s/img), rivaling high-end desktop GPUs.

## Linux + RTX 4080 16GB (CUDA)

13 cat images, 4 rounds each, auto long side 1024px (Large) / 256px (Thumb).

| Mode | Image Size | Cold Start (R1 1st) | Round Details (R2/R3/R4) | Stable Avg (Warm) | VRAM / RAM Usage |
|------|------------|-----------------|---------------|--------------------|------------------|
| VLM only | Large (1024px) | 2.14s | 2.76s / 2.75s / 2.75s | **2.75s/img** | ~7.7GB (Peak) |
| VLM only | Thumb (256px) | 12.37s* | 0.64s / 0.59s / 0.58s | **0.60s/img** | ~7.7GB (Peak) |
| VLM + SAM2 | Large (1024px) | 2.62s | 3.69s / 3.74s / 3.69s | **3.71s/img** | ~8.2GB (Peak) |
| VLM + SAM2 | Thumb (256px) | 2.49s | 0.96s / 0.92s / 0.94s | **0.94s/img** | ~8.2GB (Peak) |

> *Full cold start (12.37s) includes loading weights into VRAM and PyTorch CUDA graph compilation. Other "1st" values represent switching modes while the model is pre-warmed.
> **Note**: During high-frequency inference, VLM+SAM2 stable times are extremely consistent, flatlining at 3.71s.

## Configuration

- **Long-side cap**: auto-selected by GPU VRAM (<12GB → 800px, 12–16GB → 1024px, ≥16GB → 1333px; MPS → 1024px)
- **GPU memory**: `gpu_memory.py` Strategy Pattern — `expandable_segments:True` (CUDA), `synchronize`+`empty_cache`+`gc` (MPS)
- **Model**: `facebook/sam2.1-hiera-base-plus`
