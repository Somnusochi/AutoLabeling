# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-19

### Added
- **VLM Auto-Labeling**
  - NVIDIA LocateAnything-3B integration for automatic object detection
  - Natural language prompt support (e.g., "person wearing red shirt")
  - Batch image processing
  - Video keyframe extraction with 3 modes (scene/motion/interval)
  
- **Manual Annotation**
  - Canvas-based drawing tool for bounding boxes
  - NMS (Non-Maximum Suppression) filtering
  - Multi-class annotation support
  - Keyboard shortcuts for efficient workflow

- **YOLO Training**
  - One-click training for YOLOv5/v8/v11/v26
  - Multiple model sizes (n/s/m/l/x)
  - Real-time training progress via SSE
  - Training metrics visualization (loss, mAP, precision, recall)
  - Model comparison dashboard

- **Model Validation**
  - Image validation with confidence scores
  - Real-time video validation with MJPEG streaming
  - Batch validation for multiple images
  - Model performance metrics (mAP, precision, recall)

- **Export & Deployment**
  - YOLO format export (.txt annotations)
  - ONNX model conversion
  - Dataset packaging (images + labels + data.yaml)
  - Model download (.pt format)

- **Infrastructure**
  - FastAPI backend with PostgreSQL
  - React + TypeScript frontend
  - Docker multi-stage builds
  - GitHub Actions CI/CD pipeline
  - Automated Docker image publishing to GHCR
  - Automated release workflow with changelog generation

- **Documentation**
  - Comprehensive user guide (English & Chinese)
  - Getting started tutorial
  - Annotation best practices
  - Training parameter tuning guide
  - API documentation (auto-generated via FastAPI)
  - Docker deployment guide with GPU support

- **Testing**
  - 31 unit tests covering core functionality
  - 100% test pass rate
  - Automated testing in CI pipeline

### Changed
- N/A (initial release)

### Deprecated
- N/A (initial release)

### Removed
- N/A (initial release)

### Fixed
- N/A (initial release)

### Security
- Non-root Docker container user
- Input validation on all API endpoints
- Secure file upload handling
- Environment variable-based configuration

## [Unreleased]

### Planned
- Additional VLM model support (Grounding DINO, SAM)
- Instance segmentation annotation
- Active learning for smart sample selection
- COCO and Pascal VOC export formats
- Model version management
- Team collaboration features
