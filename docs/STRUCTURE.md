# Project Structure

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
│   │   │   ├── exceptions.py        # Custom exceptions
│   │   │   └── middleware.py        # Request ID, CORS, logging
│   │   ├── models/                  # SQLAlchemy ORM
│   │   │   ├── detection.py         # Detection & bounding boxes (incl. mask_polygon)
│   │   │   ├── train.py             # Training jobs (detect & segment)
│   │   │   └── video.py             # Videos & keyframes
│   │   ├── repositories/            # Data access layer
│   │   │   └── detection.py         # DetectionRepository
│   │   ├── schemas/                 # Pydantic models (camelCase)
│   │   │   ├── common.py            # APIResponse, BaseSchema
│   │   │   ├── detection.py         # DetectionOut, DetectionBoxOut, ExportBatchIn
│   │   │   └── train.py             # TrainingJobOut, TrainRequest
│   │   ├── services/
│   │   │   ├── detection_strategy.py # Strategy pattern (VLM / VLM+SAM2 / SAM3)
│   │   │   ├── box_filter.py        # Box filtering, NMS dedup
│   │   │   ├── locate_anything.py   # VLM inference engine
│   │   │   ├── sam2_service.py      # SAM2 segmentation service
│   │   │   ├── sam3_client.py       # SAM3 HTTP client + watchdog
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
│   │   ├── env.py
│   │   └── versions/
│   ├── sam3_server.py              # SAM3 standalone WSGI server (port 8002)
│   ├── sam3-venv/                   # SAM3 dedicated virtual environment
│   ├── requirements.txt
│   └── pyproject.toml
├── frontend/
│   └── src/
│       ├── components/              # React UI components
│       │   ├── DetectionCanvas.tsx  # Image annotation canvas (bbox + mask)
│       │   ├── DetectionResult.tsx  # Detection result with multi-format export
│       │   ├── TrainingPanel.tsx    # YOLO training panel (detect & segment, dataset download)
│       │   ├── HistoryList.tsx      # Detection history (paginated, export)
│       │   ├── HistoryListItem.tsx  # Individual history item card
│       │   ├── ResultTable.tsx      # Results table with mask column
│       │   ├── ModelStatus.tsx      # VLM + SAM2 model status display
│       │   ├── Sam3Status.tsx       # SAM3 model status display
│       │   ├── training/            # YOLO training sub-components
│       │   │   ├── TrainingCandidateList.tsx
│       │   │   ├── CandidateListItem.tsx
│       │   │   ├── TrainingJobItem.tsx
│       │   │   ├── TrainingPreview.tsx
│       │   │   ├── HoverPreview.tsx # On-demand detection detail for hover
│       │   │   └── StatusBadge.tsx
│       │   ├── Sidebar.tsx          # Main sidebar (model selector, SAM2/SAM3 toggle)
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
│       ├── hooks/                   # Custom hooks (useHomeState, useModelEvents, useBatchDetection, ...)
│       ├── i18n/locales/            # en.json, zh.json, ja.json
│       ├── services/api.ts          # Unified API layer
│       ├── lib/                     # Constants, filters, parsers, yoloExport
│       └── types/index.ts           # TypeScript types (BBox, Detection, TrainingJob)
├── docs/                            # Documentation & screenshots
│   ├── API.md                       # API reference
│   ├── STRUCTURE.md                 # Project structure (this file)
│   ├── guide/                       # 中文用户指南
│   └── guide/en/                    # English user guide
├── docker-compose.yml
├── start.sh / start.bat
└── README.md
```
