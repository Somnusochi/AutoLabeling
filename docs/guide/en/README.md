# User Guide

Welcome to VLM-AutoYOLO! This guide will help you get started and make the most of this end-to-end object detection auto-labeling and training platform.

## Guide Contents

- [Getting Started](./getting-started.md) - Complete workflow from installation to your first detection
- [Annotation Best Practices](./annotation-tips.md) - Tips and tricks for VLM pre-labeling and manual refinement
- [Training Parameter Tuning](./training-guide.md) - YOLO training parameter selection and dataset preparation guide

## System Requirements

| Resource | Minimum Configuration |
|----------|----------------------|
| **NVIDIA GPU** | 12GB VRAM (for VLM and YOLO training acceleration) |
| **macOS (Apple Silicon)** | 24GB Unified Memory (MPS) |
| **Memory (CPU Mode)** | 16GB System RAM (32GB recommended) |
| **Storage** | 50GB available space |
| **OS** | macOS 12+ / Ubuntu 20.04+ / Windows 10+ |
| **Python** | 3.12+ |
| **Node.js** | 22+ |
| **PostgreSQL** | 16+ |
| **ffmpeg** | Any version (for video keyframe extraction) |


## Core Workflow

```
Upload Images/Video → VLM / SAM3 Auto-Labeling → Manual Refinement → Export Dataset → Train YOLO → Validate Model
```

1. **Choose Model**: VLM+SAM2 (detection + segmentation) or SAM3 (text-driven end-to-end)
2. **Auto-Labeling**: VLM or SAM3 generates bounding boxes and masks automatically
3. **Data Export**: Export YOLO format annotation files (single image and batch supported)
4. **Model Training**: One-click training for YOLOv5/v8/v11/v26 with real-time progress monitoring
5. **Model Validation**: Validate training results on test images/videos

## Quick Navigation

- First time user? → [Getting Started](./getting-started.md)
- Want to improve labeling quality? → [Annotation Best Practices](./annotation-tips.md)
- Training results not ideal? → [Training Parameter Tuning](./training-guide.md)

## Getting Help

- Check the [API Documentation](http://localhost:8000/docs) for detailed backend interface information
- Having issues? Please submit feedback on [GitHub Issues](https://github.com/Somnusochi/VLM-AutoYOLO/issues)
