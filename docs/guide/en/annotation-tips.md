# Annotation Best Practices

High-quality labeled data is the key to training excellent models. This guide shares tips and tricks for VLM pre-labeling and manual refinement.

## VLM Pre-Labeling Tips

### 1. Be Specific with Category Descriptions

**Good descriptions**:
```
red car, blue truck, person wearing helmet
white cat, black dog, brown bird
laptop computer, mobile phone, tablet device
```

**Poor descriptions**:
```
vehicle, animal, device
object, thing, item
```

**Why**: VLM understands specific descriptions more accurately and generates more precise bounding boxes.

### 2. English Works Better

Although the system supports Chinese, English descriptions typically yield better detection results:

```
# Recommended
person, car, bicycle

# Usable but slightly less effective
人, 汽车, 自行车
```

### 3. Detect in Batches

For complex scenes, detect different categories in multiple passes:

```
First pass: person, car
Second pass: traffic light, stop sign
Third pass: bicycle, motorcycle
```

**Advantages**:
- Avoids quality degradation from too many categories
- Allows different filtering strategies for different categories
- Easier to identify and correct issues

### 4. Leverage Natural Language Descriptions

LocateAnything-3B supports natural language, enabling more complex scene descriptions:

```
person holding umbrella
car with open door
dog running on grass
bottle on table
```

### 5. Image Quality Matters

- **Clarity**: Blurry images have poor detection results
- **Lighting**: Too dark or overexposed affects detection
- **Angle**: Targets at extreme angles may not be detected
- **Occlusion**: Severely occluded targets are difficult to detect

**Recommendation**: Prioritize labeling high-quality images. Skip or manually label poor quality images.

## Manual Refinement Tips

### 1. Start Global, Then Go Local

**Recommended workflow**:
1. First use "All" mode to view complete VLM detection results
2. Switch to "Best" mode to check the best box for each category
3. Use "NMS" mode to remove overlapping boxes
4. Finally enter "Annotation" mode for fine adjustments

### 2. Use Filter Modes Wisely

| Mode | Use Case | Description |
|------|----------|-------------|
| **All** | Initial review | View all detection boxes to understand VLM detection status |
| **Best** | Quick filtering | Keep only one best box per category, suitable for clear category scenarios |
| **NMS** | Deduplication | Remove overlapping boxes, IoU threshold adjustable (0.3-0.7) |

**NMS IoU Tuning Recommendations**:
- **0.3-0.4**: Strict deduplication, suitable for dense target scenarios
- **0.5-0.6**: Balanced deduplication, general recommendation
- **0.7-0.8**: Lenient deduplication, keeps more boxes

### 3. Annotation Mode Tips

#### Quick Box Addition
1. Select category from history (click category tag)
2. Drag on canvas to draw
3. Release mouse to auto-save

#### Precise Box Adjustment
- Click box edges to fine-tune position
- Use keyboard arrow keys for precise movement
- Hold Shift key for proportional scaling

#### Batch Deletion
- Select multiple boxes then press Delete
- Or use "Delete All" to clear all boxes on current image

### 4. Save Filter Settings

If a filter strategy works well, click "Save Filter Results":
- Settings persist to database
- Automatically applied during export and training
- Avoids repeated adjustments each time

## Video Annotation Tips

### 1. Choose the Right Extraction Method

| Method | Use Case | Pros | Cons |
|--------|----------|------|------|
| **Scene Change** | Videos with large scene changes | Auto-detects keyframes | May miss similar scenes |
| **Motion Detection** | Videos with obvious target movement | Captures moving targets | Poor for static targets |
| **Fixed Interval** | Videos requiring uniform sampling | Simple and controllable | May extract redundant frames |

**Recommendation**: Start with "Scene Change", try other methods if results are poor.

### 2. SSIM Deduplication Tuning

SSIM threshold controls deduplication degree (0.5-1.0):
- **0.90-0.95**: Strict deduplication, significantly reduces frame count
- **0.95-0.98**: Balanced deduplication, general recommendation
- **0.98-1.0**: Lenient deduplication, keeps more frames

**Recommendation**: Start with default 0.95, adjust based on results.

### 3. Keyframe Selection Strategy

**Don't select all**:
- Videos typically have many frames (hundreds to thousands)
- Selecting all creates massive labeling workload
- Many frames have similar content with low labeling value

**Recommended approach**:
1. Browse timeline, select representative frames
2. Prioritize frames with clear targets and diverse angles
3. Generally 50-200 frames are sufficient for training

## Dataset Preparation Tips

### 1. Dataset Size Recommendations

| Task Complexity | Recommended Images | Description |
|-----------------|-------------------|-------------|
| **Simple** (1-2 categories) | 100-300 | Like detecting people, cars |
| **Medium** (3-5 categories) | 300-500 | Like traffic scenes |
| **Complex** (6+ categories) | 500-1000 | Like complex industrial scenes |

**Note**: Quality is more important than quantity. 100 high-quality annotations > 1000 low-quality annotations.

### 2. Category Balance

Ensure relatively balanced sample counts for each category:

**Good distribution**:
```
person: 150 images
car: 120 images
bicycle: 100 images
```

**Poor distribution**:
```
person: 500 images
car: 50 images
bicycle: 10 images
```

**Solutions**:
- Increase minority category samples
- Reduce majority category samples
- Use data augmentation (rotation, flip, crop)

### 3. Dataset Split

Recommended train/validation/test ratios:

| Dataset Size | Train | Val | Test | Description |
|--------------|-------|-----|------|-------------|
| **< 200 images** | 70% | 20% | 10% | Small dataset, more validation |
| **200-500 images** | 80% | 10% | 10% | Medium dataset, standard split |
| **> 500 images** | 85% | 10% | 5% | Large dataset, more training data |

**System default**: 70/20/10, suitable for most scenarios.

### 4. Annotation Quality Check

Check before export:
- [ ] All targets are labeled
- [ ] Bounding boxes tightly fit target edges
- [ ] Category names are correct and consistent
- [ ] No important targets are missed
- [ ] No incorrect annotation boxes

**Common errors**:
- Boxes too large or too small
- Category name spelling errors (like `preson` vs `person`)
- Multiple boxes for same target
- Occluded targets not labeled

## Advanced Techniques

### 1. Iterative Labeling

**Workflow**:
1. First use VLM to label a small batch (50-100 images)
2. Train an initial model
3. Use this model to pre-label more images
4. Manually refine and train again
5. Repeat until satisfied

**Advantage**: Gradually improves model quality while reducing manual workload.

### 2. Prioritize Hard Samples

Prioritize labeling these images:
- Images with small targets
- Images with dense targets
- Images with poor lighting
- Images with severe occlusion

**Why**: These are the scenarios where models are most prone to errors, and annotation quality has the greatest impact on model performance.

### 3. Multi-Round Validation

Don't just look at mAP metrics after training:
1. Validate on training set (check for overfitting)
2. Validate on validation set (check generalization)
3. Validate on test set (final evaluation)
4. Validate on real-world video (actual application performance)

**If training set mAP is high but test set is low**: Indicates overfitting, need more data or data augmentation.

## Summary

Keys to high-quality annotation:
1. **VLM Pre-Labeling**: Use specific English descriptions, detect in batches
2. **Manual Refinement**: Start global then local, use filter modes wisely
3. **Video Annotation**: Choose appropriate extraction method, don't select all
4. **Dataset Preparation**: Sufficient quantity, balanced categories, high quality
5. **Iterative Optimization**: Label → Train → Validate → Improve

Next: [Training Parameter Tuning](./training-guide.md)
