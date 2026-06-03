# User Guide

Welcome to VLM-AutoYOLO! This guide will help you get started and make the most of this end-to-end object detection auto-labeling and training platform.

## Guide Contents

- [Getting Started](./getting-started.md) - Complete workflow from installation to your first detection
- [Annotation Best Practices](./annotation-tips.md) - Tips and tricks for VLM pre-labeling and manual refinement
- [Training Parameter Tuning](./training-guide.md) - YOLO training parameter selection and dataset preparation guide

## System Requirements

| Platform | Minimum Configuration |
|----------|----------------------|
| **GPU** | NVIDIA GPU 8GB+ VRAM / Apple Silicon (MPS) |
| **Memory** | 16GB RAM (32GB recommended) |
| **Storage** | 50GB available space |
| **OS** | macOS 12+ / Ubuntu 20.04+ / Windows 10+ |
| **Python** | 3.12+ |
| **Node.js** | 22+ |

## Core Workflow

```
Upload Images/Video → VLM Auto-Labeling → Manual Refinement → Export Dataset → Train YOLO → Validate Model
```

1. **VLM Pre-Labeling**: Use LocateAnything-3B vision-language model to automatically generate bounding boxes
2. **Manual Refinement**: Adjust, delete, and add annotation boxes on the canvas
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
