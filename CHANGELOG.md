# Changelog

## v1.5.2 (2026-06-05)

- Integrate cloud benchmark records (RTX 4080) into local PostgreSQL database
- UX: Add global loading progress bar for all pending queries and mutations
- Deployment: Mount frontend static files to root (`/`) for single-container Docker deployments
- Add `benchmark_script.py` and `decord` dependency

## v1.5.1 (2026-06-05)

- Fix: use base color when confidence is null (was showing red)
- Feat: expose SAM2 score threshold slider for mask quality filtering
- CI: restore tag-triggered Docker and Release workflows

## v1.5.0 (2026-06-05)

- Feat: improve CategoryInput — add remove button, dedup, visual polish
- Docs: bump GPU VRAM minimum from 10GB to 12GB, add throttling warning
- Docs: add star badge and star-history chart to READMEs (EN/ZH)
- Docs: add badges and emoji pipeline flow to README headers (EN/ZH)
- Docs: rewrite CLAUDE.md with architecture overview, commands, and workflow rules
- CI: Docker and Release workflows now trigger on published Release, not every tag

## v1.4.9 (2026-06-05)
- Japanese (日本語) i18n — full UI translation
- Three-button language selector (中 / EN / 日) matching theme toggle style
- SAM2 status labels — "SAM2 模型" instead of "VLM 模型"
- Frontend: HistoryList pagination, training component refactor

## v1.4.8 (2026-06-05)

- Fix: `MAX_LONG_SIDE` lazy-init so tests can import without GPU (CI on CPU runners)

## v1.4.7 (2026-06-05)

- VLM confidence score infrastructure: `<conf>` parser, DB wiring, canvas color-coding
- Fix: `parse_boxes` test assertions for new confidence field

## v1.4.6 (2026-06-05)

- Class-based color mapping on canvas (color per category name)

## v1.4.5 (2026-06-05)

- Ruff format — 2 files

## v1.4.4 (2026-06-05)

- SQLite support — zero-config local database fallback

## v1.4.3 (2026-06-05)

- Docs restructure: API, structure, benchmarks extracted to `docs/`
- Chinese docs: `API_ZH.md`, `STRUCTURE_ZH.md`, `BENCHMARKS_ZH.md`
- Frontend restructure: training sub-components, `HistoryListItem`
- Ruff lint + format all green

## v1.4.2 (2026-06-05)

- Fix: remove non-existent `reset_image()` call that broke SAM2 mask generation
- Full README rewrite (EN + ZH) — cold/warm benchmark separation

## v1.4.1 (2026-06-05)

- GPU memory strategy pattern (`gpu_memory.py`) — centralized CUDA/MPS cleanup
- `expandable_segments:True` replaces `max_split_size_mb` for CUDA
- MPS `synchronize` + `empty_cache` + `gc` after each detection
- Mac memory stable at 9.8–13GB across 6 rounds

## v1.4.0 (2026-06-04)

- VRAM-aware image long-side cap (auto: 800/1024/1333px)
- Stable Mac MPS & Windows CUDA benchmarks
- SAM2 mask coordinate fix (original image space alignment)

## v1.3.4 (2026-06-04)

- Fix: SAM2 mask misalignment when `detect()` resizes large images
- Unify box/mask coordinates to original image space

## v1.3.3 (2026-06-04)

- Aggressive VRAM cleanup + `max_split_size_mb:128` allocator tuning
- Sustained inference memory management

## v1.3.2 (2026-06-04)

- VRAM optimizations for 10GB GPUs

## v1.3.1 (2026-06-04)

- Reduce `max_new_tokens` from 2048 to 512 — fix VRAM pressure on 10GB GPUs

## v1.3.0 (2026-06-04)

- **SAM2.1 segmentation** — bbox → pixel-precise mask polygons
- Multi-format dataset export: YOLO, YOLO-Seg, COCO, Pascal VOC, CreateML
- Instance segmentation training support (Segment task type)
- BBox / Mask independent toggle on canvas and hover preview
- Model idle watchdog — auto-unload after configurable timeout
- Windows cross-platform support, model download progress, UX improvements

## v1.2.0 (2026-06-04)

- SAM2 integration, multi-format export, instance segmentation training

## v1.1.2 (2026-06-04)

- Restore `MAX_IMAGE_PX` to 1024×1024 for GPU inference

## v1.1.1 (2026-06-04)

- Fix Docker volume config, clarify platform support (Windows WSL2 + NVIDIA GPU)

## v1.1.0 (2026-06-04)

- Video annotation & keyframe extraction (scene/motion/interval)
- MJPEG / SSE video validation
- Remove CPU mode — LocateAnything-3B requires GPU

## v1.0.1 (2026-06-04)

- Fix frontend layouts, CI triggers, unify database naming

## v1.0.0 (2026-06-04)

- Initial stable release
- VLM detection with LocateAnything-3B
- YOLO training (v5/v8/v11/v26) with SSE real-time progress
- Model validation (MJPEG live stream, SSE video, batch images)
- Canvas-based manual annotation with NMS filtering
- Detection history management
- Box filter service (best/NMS/all)
- Cross-platform: macOS MPS + Windows/Linux CUDA
- English / 中文 README with project structure and API docs

## Pre-v1.0 (2026-06-02)

- Initial commit — YOLO auto-labeling training platform
- VLM detection pipeline with LocateAnything-3B
- YOLO training integration (v5/v8/v11/v26) with cascading model variant selector
- Manual box annotation with canvas drawing mode
- Detection history with thumbnails, tag filtering, hover preview popover
- Cross-platform device auto-detect (CUDA / MPS)
- Box filter service: best / NMS / all modes
- Database redesign with JSONB types and association tables
- CI/CD workflows (lint, test, Docker, release)
- Light/dark/system theme with inline button group
- i18n: English / 中文 via i18next
