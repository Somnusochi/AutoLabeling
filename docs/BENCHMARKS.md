# Inference Benchmarks

## Windows 11 + RTX 3080 10GB (CUDA)

13 cat images (Pexels, mixed resolutions), 4 rounds each, auto long side 800px, `max_new_tokens=512`.

| Mode | Image Size | Cold Start (R1 1st) | Round Details (R2/R3/R4) | Stable Avg (Warm) | Peak VRAM |
|------|------------|---------------------|--------------------------|-------------------|-----------|
| VLM only | Large (800px) | 8.26s | 7.43s / 6.61s / 5.73s | **6.59s/img** | ~9.8 GB |
| VLM only | Thumb (256px) | 0.70s | 1.28s / 1.15s / 1.68s | **1.37s/img** | ~10.0 GB |
| VLM + SAM2 | Large (800px) | 1.27s | 1.86s / 1.85s / 1.86s | **1.86s/img** | ~9.0 GB |
| VLM + SAM2 | Thumb (256px) | 1.76s | 0.82s / 0.83s / 0.83s | **0.83s/img** | ~9.8 GB |

> *True application cold start (first API call after server boot): **~0.70s**. Model weights cached in OS file cache after initial warm-up; subsequent loads are significantly faster than the ~22s first-ever cold start.
> *Suites run sequentially (VLM-only → VLM+SAM2); later suites benefit from pre-compiled CUDA graphs and settled VRAM allocation.
>
> **VRAM pressure is the primary bottleneck on 10 GB cards**: VLM-only large-image processing shows high run-to-run variance (1.7–16.5s) due to VRAM peaking at 9.8 GB (96% of limit). VLM+SAM2 large-image performance is extremely consistent (1.85–1.86s, stddev < 0.01s) once VRAM settles at ~9.0 GB.
>
> **Fastest warm per-image times**: VLM-only Thumb ~0.58s, VLM-only Large ~1.74s, VLM+SAM2 Thumb ~0.76s, VLM+SAM2 Large ~1.27s. SAM2 overhead on a fully warm pipeline: ~0.03–0.06s/img.
>
> **Recommendation**: 12 GB+ VRAM strongly recommended for stable production inference. 10 GB works but suffers allocator thrashing under sustained large-image load.

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
