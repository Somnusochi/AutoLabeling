# Changelog

## v1.5.9 (2026-06-08)

### Performance & Infrastructure
- Perf: increase chunk upload size 5MB → 20MB for 4× faster dataset imports
- Feat: `max_import_size_mb` config (default 10GB) with validation in chunk_init and frontend file picker
- Depr: mark `POST /datasets/import` direct upload endpoint as deprecated in favor of chunked upload
- Feat: increase video upload limit 100MB → 500MB with dedicated `max_video_upload_size_mb` setting
- Feat: per-request HTTP timeouts — 10min for detection, 5min for uploads, 1min default

### Training Job Management
- Feat: rename training jobs via Popconfirm with inline text input (`POST /train/jobs/{id}/rename`)
- Feat: `name` column added to `TrainingJob` model (nullable String(128))
- Style: num_classes count shown in `text-primary-600`

### Virtual Lists & Infinite Scroll
- Feat: virtualize training job list (`JobHistoryList`) and video list (`VideoList`) with `@tanstack/react-virtual`
- Feat: infinite scroll pagination for detection history, training jobs, and videos
- Feat: `useInfiniteScroll` hook — unified scroll-to-bottom trigger for all virtual lists
- Feat: `useLoadAll` hook — "Load All" button that fetches remaining pages in bulk
- Feat: "Load All (X remaining)" button in detection history and training panel count lines
- Feat: scroll hint text at bottom of virtual lists — loading spinner, loaded count, or "All loaded"
- Feat: increase pageSize limits — detections 100000, training jobs 1000, videos 1000

### UI Fixes
- Fix: training preview canvas label position clamped at image edges (matching DetectionCanvas logic)
- Fix: video list item overlap — add `measureElement` for dynamic row heights

### Testing
- Test: 10-image detect→train→validate→download end-to-end integration test
- Test: `test_rename_job` + `test_rename_job_404` integration tests
- Test: 4 `useLoadAll` + 4 `useScrollLoad` hook unit tests
- Total: 81 backend + 42 frontend tests passing

## v1.5.10 (2026-06-09)

### CLI
- Feat: `python3 cli.py all` — one-command setup, model download, and launch
- Feat: `--models=vlm|sam2|all` select which models to pre-download (~6GB / ~2.4GB)
- Feat: `stop` / `status` / `download` commands, `--help`, `--no-models`
- Feat: automatic SAM3 HF_TOKEN check with step-by-step setup guide
- Feat: cross-platform (Windows/Linux/macOS), pnpm auto-install, port conflict detection

### Security
- Fix: ZIP path traversal — validate each member against extract_dir with `Path.is_relative_to`
- Fix: chunk upload hardening — random UUID uploadId, chunkSize validation (1-50MB), Content-Length pre-check, assembly size verify, fixed docstring for resume semantics
- Fix: database migration fail-fast for PostgreSQL (create_all only for dev/SQLite)
- Fix: SSE reconnect timer leak on component unmount
- Fix: "Clear All Videos" bulk delete paginates through all rows, always queries page=1

### Refactoring
- Refactor: split `dataset_import.py` (629 lines) into package (`yolo`, `coco`, `voc`, `createml` + helpers)
- Refactor: extract `VideoList` + `ExtractionPanel` from `VideoPanel` (591→224 lines)
- Refactor: extract `Header` + `DetectionControls` from `Sidebar` (496→233 lines)
- Refactor: rename `useInfiniteScroll` → `useScrollLoad` (avoid ahooks name conflict)
- Perf: increase virtual list `overscan` 10→20 to reduce scroll white flash

### Fixes
- Fix: multiprocessing start method `spawn` for CUDA compatibility in YOLO training

## v1.5.8 (2026-06-08)

### Docker & CI
- Feat: embed GPU passthrough in `docker-compose.yml` — no manual yaml editing required
- Feat: add `.dockerignore` for backend and frontend — excludes ~2.8GB venv/node_modules from build context
- Fix: add Free disk space step before Docker build in CI to prevent disk-full crashes

### UI
- Feat: class map Popover on hover for `num_classes` in training job metrics

## v1.5.7 (2026-06-08)

### Backend Refactoring
- Refactor: extract `detection_service.py` — orchestrates GPU offload → inference → persistence
- Refactor: replace raw strings with `StrEnum` (ModelType, FilterMode, DetectionStatus)
- Refactor: add `DetectionParams` schema to group 7 scattered detection parameters
- Refactor: repository methods gain optional `commit=` param, removing ad-hoc `repo.db.commit()` calls
- Refactor: strategies receive dependencies via constructor DI instead of lazy imports

### Dataset Import
- Feat: import datasets from ZIP archives in 5 formats: YOLO, YOLO Seg, COCO, Pascal VOC, CreateML
- Feat: chunked upload with Web Worker — 5MB chunks, 3 retries, progress bar
- Feat: resume support — deterministic uploadId from fileName+size, skip already-uploaded chunks
- Feat: backend parsers for all 5 formats with proper coordinate conversion and edge case handling
- Feat: `DatasetImportModal` with format selector, drag-drop zone, progress tracking, cancel
- Test: 21 unit tests for format parsers (YOLO line, names, polygon, COCO, VOC, CreateML)

### Training Queue
- Feat: background worker picks up pending training jobs, runs one at a time via multiprocessing
- Feat: cancel training — `POST /train/jobs/{id}/cancel` terminates running process, sets "cancelled"
- Feat: training button disabled when job running; detection disabled with amber warning
- Feat: `Popconfirm` replaces `window.confirm()` for all delete/cancel actions
- Feat: "Import Dataset" button in TrainingPanel

### Detection Improvements
- Feat: cancel in-flight detection with AbortController — truly aborts HTTP requests
- Fix: SAM3 health check race condition — wait for `status=="loaded"`, not just HTTP 200
- Fix: Enum `values_callable` to match existing DB data (e.g. `'vlm+sam2'` not `'vlm_sam2'`)
- Fix: validation conf/iou parameters now read from Zustand (were stale local state)
- Fix: canvas image load race condition with `loadId` counter
- Fix: model status flicker — skip `optimisticModelLoading` when already loaded
- Fix: batch thumbnails show loading only for actively-processing images
- Fix: batch detection `result` cleanup → thumbnails visible immediately

### Frontend Architecture
- Refactor: migrate components from flat `.tsx` to directory structure (`ComponentName/index.tsx`)
- Refactor: decompose `useHomeState` (394 lines) into `useDetectionProcess`, `useDetectionHistory`,
  `useDetectionAnnotation`, `useDetectionTimer`, `useDetection`
- Refactor: move `result`/`batchResults` from hook local state to Zustand `useAppStore`
- Test: add vitest + `@testing-library/react` + `jsdom` with 28 test files (34 tests)
- Test: add `setupTests.ts` with i18n mock, axios mock, EventSource mock, matchMedia mock

### i18n
- Chore: rewrite `ja.json` with kanji-heavy Japanese (取消, 登録, 導入, 出力, 一括, etc.)
- Chore: sync all i18n keys across zh/en/ja (cancel, bbox, mask, dataset import, delete confirm)

### Fixes
- Fix: `setPreviewUrl` no longer auto-revokes blob URLs (caused broken thumbnails)
- Fix: blob URL lifecycle with `useRef`-based caching to prevent URL churn
- Fix: `maskClosable` → `mask.closable` (antd deprecation)
- Fix: `_read_yolo_names` unbound `names` variable when `data.yaml` missing
- Fix: strategy test constructor calls (DI requires mock functions)
- Fix: test SAM3 skip condition also checks local model cache
- Fix: `test-results/` added to `.gitignore`

## v1.5.6 (2026-06-07)

### State Management Refactoring
- Refactor: introduce Zustand (`useAppStore`) for global state, replacing 4 individual hooks
- Remove: `useModelConfig`, `useUploadState`, `useAnnotationState` (consolidated into store)
- Simplify: `useHomeState` now reads from store, ~100 lines lighter
- Simplify: `Sidebar` props reduced from 60+ to 14, `Home` reads state directly from store

### UX Improvements
- Feat: loading overlay shows contextual text ("模型加载中" / "检测进行中")
- Feat: optimistic model status updates — loading/unload reflects immediately without waiting for SSE poll
- Fix: SAM2 loading state not shown when model loads faster than SSE interval
- Fix: model unload status delayed up to 10s — now instant via optimistic update

### Fixes
- Fix: unused `threading` import in `train.py`
- Fix: E2E detection test selector (Ant Design uses div, not `<table>`)

## v1.5.5 (2026-06-07)

### Refactoring & Code Quality
- Refactor: split `useHomeState` (311-line giant hook) into `useModelConfig`, `useUploadState`, `useAnnotationState`, `useDetectionTimer` — `useHomeState` now coordinates
- Test: add Playwright E2E tests (6 cases: page render, model switch, history list, detail view, model status, upload+detect)
- Test: add integration tests (10 cases: VLM/SAM3 detection, list/detail consistency, SSE, model management, mask validation)
- Test: add regression snapshot tests (7 cases: 5 images × box position + model type consistency)
- Test: add `test_api_integration.py` with data integrity checks (box bounds, confidence range, polygon validity, list/detail consistency)
- Chore: add commitlint config (conventional commits)

## v1.5.4 (2026-06-07)

### SAM3 Stability & Performance
- Fix: SAM3 stuck at "loading" when HF_TOKEN not set — fall back to `local_files_only=True` for cached models
- Fix: SAM3 load errors silently swallowed — wrap `load_model` in try/except, report errors via `/health`
- Fix: HF_TOKEN required even when model cached — only check token when cache missing
- Fix: SAM3 stdout/stderr redirected to log file instead of DEVNULL for debugging
- Fix: SAM3 server using wrong Python interpreter — always prefer `sam3-venv/bin/python3` when available
- Opt: skip alembic migration check when database already at head revision, reducing startup time

### Bug Fixes
- Fix: history detail view not showing mask polygons — `handleSelectHistory` now fetches full detection detail
- Fix: frontend CI build failure — add missing `modelType` field in `useYoloValidation`
- Fix: `ruff format` violation in `detection_strategy.py`
- Fix: remove `.playwright-mcp` debug artifacts from git tracking and add to `.gitignore`

### UX
- Batch thumbnails show box count badge
- Keyboard arrow keys (← →) navigate between batch results

### Docker
- SAM3 service in `docker-compose.yml` (port 8002, `sam3-cache` volume, `HF_TOKEN` env)
- Dockerfile creates dedicated `sam3-venv` for dependency isolation
- `requirements-sam3.txt` for SAM3 server dependencies

### Tests & Docs
- Add `test_detection_strategy.py` (9 tests: strategy creation, DetectionResult, SAM3 priority)
- Add macOS MPS SAM3 benchmarks to `docs/BENCHMARKS.md`
- Update `docs/STRUCTURE.md` and user guides with SAM3 content

## v1.5.3 (2026-06-06)

### SAM3 Integration
- Feat: add SAM3 (facebook/sam3) as third detection strategy — text-driven open-vocabulary detection + segmentation
- Feat: SAM3 standalone HTTP service on port 8002 with dedicated venv (transformers 5.x, torch 2.12)
- Feat: model selector toggle in sidebar (VLM+SAM2 / SAM3)
- Feat: SAM3 confidence threshold slider (0–1, default 0.5) and mask threshold slider (0–1, default 0.5)
- Feat: SAM3 segmentation on/off checkbox — bbox-only mode skips mask extraction
- Feat: SAM3 idle watchdog — auto-unload after `MODEL_IDLE_TIMEOUT_SECONDS` (default 10 min)
- Feat: SAM3 manual unload button with toast feedback
- Feat: backend auto-unloads competing models on detection (SAM3 ↔ VLM/SAM2)
- Feat: SAM3 server async startup — HTTP ready immediately, model loads in background, `/health` reports `starting` → `loading` → `loaded`

### Architecture
- Feat: strategy pattern (`detection_strategy.py`) — `VLMDetection`, `VLMWithSAM2`, `SAM3Detection`
- Feat: unified SSE endpoint `GET /api/v1/model/events` — VLM/SAM2/SAM3 status in one EventSource, replaces 3 polling intervals
- Feat: `useModelEvents` hook — single SSE subscriber, all model status components read from it
- Feat: `Detection.model_type` column — labels each record as `vlm`, `vlm+sam2`, or `sam3`
- Feat: list endpoint returns lightweight boxes without `maskPolygon`; detail endpoint retains full mask data
- Feat: `HoverPreview` component — on-demand fetch of detection detail for training hover preview
- Fix: VLM detection coordinate scaling lost during refactoring — boxes now correctly scaled back to original image space
- Fix: SAM3 server multipart body construction — fields properly separated with boundary markers
- Fix: `create_strategy` swallowing kwargs — `use_sam3_seg`, threshold params now passed to `detect()`

### Frontend
- Feat: model type badges in history list and training candidate list (color-coded: blue=VLM, amber=VLM+SAM2, violet=SAM3)
- Feat: batch detection loading states — canvas overlay cleared once first result arrives
- Fix: model status polling now continues when `unloaded` (3s interval), preventing missed loading transitions

### Docs
- Docs: update README (EN/ZH) — SAM3 architecture, SSE status, strategy pattern, detection parameters
- Docs: update CLAUDE.md — startup env requirements, SAM3 architecture, SSE, directory conventions
- Docs: update API.md — `/detect` form parameters, model management SSE endpoint, detection object schema

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
