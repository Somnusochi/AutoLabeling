# Training Parameter Tuning

Proper training parameters are key to obtaining high-performance YOLO models. This guide helps you choose optimal parameters based on your task requirements.

## YOLO Series Selection

### Version Comparison

| Version | Characteristics | Recommended Scenarios |
|---------|----------------|----------------------|
| **YOLOv5** | Classic and stable, mature ecosystem | Legacy system compatibility, or stability-focused |
| **YOLOv8** | Balanced speed and accuracy, officially recommended | General scenarios, first choice for most tasks |
| **YOLOv11** | Latest architecture, best performance | Pursuing highest accuracy, training time not a concern |
| **YOLOv26** | Experimental, cutting-edge technology | Research and exploration, use cautiously in production |

**Recommendation**: Beginners use **YOLOv8**, performance seekers use **YOLOv11**.

### Model Size Selection

| Size | Parameters | Speed | Accuracy | VRAM Required | Recommended Scenarios |
|------|------------|-------|----------|---------------|----------------------|
| **n** (nano) | Smallest | Fastest | Lower | 2GB+ | Edge devices, real-time detection |
| **s** (small) | Small | Fast | Medium | 4GB+ | Mobile, embedded |
| **m** (medium) | Medium | Medium | Higher | 6GB+ | General recommendation, balanced speed and accuracy |
| **l** (large) | Large | Slower | High | 8GB+ | High accuracy requirements |
| **x** (xlarge) | Largest | Slowest | Highest | 12GB+ | Pursuing ultimate accuracy |

**Recommendations**:
- **8GB VRAM**: Use `m` or `s`
- **12GB+ VRAM**: Use `l` or `x`
- **Edge deployment**: Use `n` or `s`

## Core Training Parameters

### Epochs (Training Iterations)

Epochs determine how many times the model learns from the dataset.

| Dataset Size | Recommended Epochs | Description |
|--------------|-------------------|-------------|
| **< 100 images** | 300-500 | Small datasets need more epochs |
| **100-300 images** | 200-300 | Medium datasets, standard config |
| **300-500 images** | 150-200 | Larger datasets, reduce appropriately |
| **> 500 images** | 100-150 | Large datasets, avoid overfitting |

**How to detect overfitting**:
- Training Loss continues decreasing, but Validation Loss starts increasing
- Training set mAP is high, but test set mAP is low
- Model performs perfectly on training images but poorly on new images

**Solutions**:
- Reduce Epochs
- Increase data volume
- Use data augmentation

### ImgSz (Input Image Size)

Input image size affects detection accuracy and speed.

| Size | Speed | Accuracy | Recommended Scenarios |
|------|-------|----------|----------------------|
| **416** | Fastest | Lower | Few small targets, speed-focused |
| **512** | Fast | Medium | Balanced speed and accuracy |
| **640** | Medium | Higher | **General recommendation**, most scenarios |
| **768** | Slower | High | Many small targets, high accuracy needed |
| **1024** | Slowest | Highest | Extreme accuracy requirements |

**Recommendation**: Use **640**, this is YOLO's standard input size.

**Special cases**:
- If targets are very small (< 32x32 pixels), use 768 or 1024
- If pursuing real-time detection, use 416 or 512

### Batch (Batch Size)

Batch size affects training stability and VRAM usage.

| VRAM | Recommended Batch | Description |
|------|------------------|-------------|
| **4GB** | 4-8 | Low VRAM, use small batches |
| **6GB** | 8-12 | Medium VRAM |
| **8GB** | 12-16 | General recommendation |
| **12GB+** | 16-32 | High VRAM, can use large batches |

**How to determine maximum Batch**:
1. Start trying from 16
2. If VRAM insufficient (OOM error), halve to 8
3. If still have headroom, increase to 24 or 32

**Note**: Larger Batch = more stable training, but higher VRAM usage.

## Advanced Parameter Tuning

### Learning Rate

The system automatically adjusts learning rate, but you can set it manually:

| Parameter | Default | Description |
|-----------|---------|-------------|
| **lr0** | 0.01 | Initial learning rate |
| **lrf** | 0.01 | Final learning rate (relative to lr0) |

**Tuning recommendations**:
- Training unstable (Loss oscillating): Reduce lr0 to 0.005
- Training too slow: Increase lr0 to 0.02
- General case: Use default values

### Data Augmentation

The system includes multiple data augmentation techniques:

| Augmentation Method | Effect | Recommendation |
|--------------------|---------|---------------|
| **Flip** | Horizontal/vertical flip | ✅ Highly recommended |
| **Rotation** | Random rotation ±15° | ✅ Recommended |
| **Scale** | Random scaling 0.5-2.0x | ✅ Recommended |
| **Crop** | Random cropping | ✅ Recommended |
| **Color Jitter** | Adjust brightness/contrast/saturation | ✅ Recommended |
| **Mosaic** | 4-image stitching | ✅ Highly recommended |
| **MixUp** | 2-image blending | ⚠️ Optional |

**Recommendation**: Keep default settings, the system has optimized data augmentation strategies.

### Optimizer Selection

| Optimizer | Characteristics | Recommendation |
|-----------|----------------|---------------|
| **SGD** | Classic optimizer, stable convergence | General recommendation |
| **Adam** | Adaptive learning rate, fast convergence | Recommended for small datasets |
| **AdamW** | Adam + weight decay | Prevents overfitting |

**Recommendation**: Use default **SGD**.

## Training Monitoring

### Key Metrics

Metrics to monitor during training:

| Metric | Meaning | Target Value |
|--------|---------|--------------|
| **Loss** | Loss function value | Continuously decreasing |
| **mAP50** | Mean Average Precision at IoU=0.5 | > 0.8 is excellent |
| **mAP50-95** | Mean AP from IoU 0.5 to 0.95 | > 0.5 is excellent |
| **Precision** | Precision (what fraction of detections are correct) | > 0.8 |
| **Recall** | Recall (what fraction of targets are detected) | > 0.8 |

### Training Curve Interpretation

**Normal training**:
```
Loss: ↘️ Continuously decreasing
mAP: ↗️ Continuously increasing
Train Loss and Val Loss decrease together
```

**Overfitting**:
```
Train Loss: ↘️ Continuously decreasing
Val Loss: ↗️ Starts increasing (after certain Epoch)
Train mAP high, Val mAP low
```

**Underfitting**:
```
Loss: ➡️ Slow decrease or plateau
mAP: ➡️ Slow increase or plateau
Both Train and Val metrics are low
```

### Common Problem Troubleshooting

**Problem 1: Loss not decreasing**
- Cause: Learning rate too small, data quality issues, category labeling errors
- Solution: Increase learning rate, check data quality, verify label correctness

**Problem 2: Loss oscillating**
- Cause: Learning rate too large, Batch too small, data imbalance
- Solution: Reduce learning rate, increase Batch, balance category distribution

**Problem 3: Out of VRAM (OOM)**
- Cause: Batch too large, ImgSz too large, model too large
- Solution: Reduce Batch, lower ImgSz, choose smaller model size

**Problem 4: Training too slow**
- Cause: Batch too small, ImgSz too large, model too large
- Solution: Increase Batch, lower ImgSz, choose smaller model size

## Model Evaluation

### Evaluation Metric Interpretation

| Metric | Meaning | Excellent | Good | Average |
|--------|---------|-----------|------|---------|
| **mAP50** | Mean AP at IoU=0.5 | > 0.9 | 0.7-0.9 | 0.5-0.7 |
| **mAP50-95** | Strict evaluation (IoU from 0.5 to 0.95) | > 0.7 | 0.5-0.7 | 0.3-0.5 |
| **Precision** | Precision | > 0.9 | 0.7-0.9 | 0.5-0.7 |
| **Recall** | Recall | > 0.9 | 0.7-0.9 | 0.5-0.7 |

### Metric Priorities

Choose priority metrics based on application scenario:

| Scenario | Priority Metric | Description |
|----------|----------------|-------------|
| **Security surveillance** | Recall | Better to have false positives than miss detections |
| **Autonomous driving** | Precision + Recall | Both must be high |
| **Industrial inspection** | Precision | Avoid false judgments causing production stops |
| **General detection** | mAP50-95 | Comprehensive evaluation |

### Confusion Matrix Analysis

After training, review the confusion matrix:
- **Diagonal**: Correct classifications
- **Off-diagonal**: Misclassifications
- **High row values**: This category easily misclassified as others
- **High column values**: Other categories easily misclassified as this one

**Improvement directions**:
- Increase samples for easily confused categories
- Check if category labels are consistent
- Consider merging similar categories

## Model Optimization

### 1. Model Distillation

Use large models to guide small model training:
1. Train with `l` or `x` model
2. Use trained large model to label more data
3. Use this data to train `s` or `m` model

**Effect**: Small model achieves performance close to large model.

### 2. Model Pruning

Reduce model parameters, improve inference speed:
```bash
# Use ultralytics pruning
yolo prune model=best.pt amount=0.3
```

**Effect**: Model size reduced by 30%, speed improved by 20-30%, accuracy loss < 1%.

### 3. Model Quantization

Convert FP32 to INT8, significantly boost speed:
```bash
# Export INT8 model
yolo export model=best.pt format=engine int8=True
```

**Effect**: Speed improved by 2-3x, accuracy loss 1-2%.

### 4. TensorRT Acceleration

Use TensorRT acceleration on NVIDIA GPUs:
```bash
# Export TensorRT model
yolo export model=best.pt format=engine
```

**Effect**: Inference speed improved by 2-5x.

## Deployment Recommendations

### Edge Device Deployment

| Device | Recommended Model | Format | Notes |
|--------|------------------|---------|-------|
| **Raspberry Pi** | YOLOv8n | ONNX / TFLite | Deploy after quantization |
| **Jetson Nano** | YOLOv8s | TensorRT | Use INT8 |
| **Jetson Xavier** | YOLOv8m | TensorRT | Use FP16 |
| **Mobile** | YOLOv8n | CoreML / TFLite | Deploy after quantization |

### Server Deployment

| Scenario | Recommended Model | Format | Notes |
|----------|------------------|---------|-------|
| **Real-time detection** | YOLOv8s/m | TensorRT | Speed-focused |
| **Offline analysis** | YOLOv8l/x | PyTorch | Accuracy-focused |
| **Batch processing** | YOLOv8m | ONNX | Cross-platform compatibility |

## Practical Cases

### Case 1: Person Detection (Simple Task)

**Dataset**: 200 images, 1 category (person)

**Recommended configuration**:
```
Model: YOLOv8s
Epochs: 200
ImgSz: 640
Batch: 16
```

**Expected results**: mAP50 > 0.9, mAP50-95 > 0.6

### Case 2: Traffic Scene Detection (Medium Task)

**Dataset**: 500 images, 5 categories (car, truck, bus, motorcycle, bicycle)

**Recommended configuration**:
```
Model: YOLOv8m
Epochs: 150
ImgSz: 640
Batch: 12
```

**Expected results**: mAP50 > 0.85, mAP50-95 > 0.5

### Case 3: Industrial Defect Detection (Complex Task)

**Dataset**: 1000 images, 8 categories (various defect types)

**Recommended configuration**:
```
Model: YOLOv8l
Epochs: 300
ImgSz: 768 (defects are small)
Batch: 8
```

**Expected results**: mAP50 > 0.8, mAP50-95 > 0.4

## Summary

Core principles of parameter tuning:
1. **Start from defaults**: System default parameters are optimized for most scenarios
2. **Adjust gradually**: Change only one parameter at a time, observe effects
3. **Monitor metrics**: Pay attention to Loss, mAP, Precision, Recall
4. **Avoid overfitting**: Training and validation metrics should improve together
5. **Choose based on scenario**: Different scenarios have different speed and accuracy requirements

**Quick start configuration**:
```
Model: YOLOv8m
Epochs: 200
ImgSz: 640
Batch: 16
```

If results are not satisfactory, refer to this guide for gradual tuning.

Next: Back to [User Guide Home](./README.md)
