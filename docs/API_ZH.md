# API 参考

所有字段使用驼峰命名（camelCase），错误携带正确的 HTTP 状态码。

Base URL: `http://localhost:8000/api/v1`

### POST `/detect` — 表单参数

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `file` | File | 必填 | 图片文件 |
| `categories` | JSON 数组 | 必填 | `["猫", "狗"]` |
| `use_sam2` | bool | `false` | 启用 VLM + SAM2 流程 |
| `use_sam3` | bool | `false` | 启用 SAM3 文本驱动流程 |
| `sam2_score_threshold` | float | `0.0` | SAM2 mask 质量阈值（0–1） |
| `use_sam3_seg` | bool | `true` | 启用 SAM3 mask 提取 |
| `sam3_threshold` | float | `0.5` | SAM3 置信度阈值（0–1） |
| `sam3_mask_threshold` | float | `0.5` | SAM3 mask 二值化阈值（0–1） |
| `sam3_text` | string | `""` | 覆盖 SAM3 文本提示（默认使用分类名拼接） |

## 检测与标注

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/detect` | 检测标注（multipart）。策略：VLM（默认）、VLM+SAM2（`use_sam2=true`）、SAM3（`use_sam3=true`） |
| GET | `/detections` | 历史列表（分页） |
| GET | `/detections/{id}` | 检测详情 |
| GET | `/detections/{id}/image` | 检测原图 |
| POST | `/detections/{id}/boxes` | 手动添加标注框 |
| PUT | `/detections/{id}/boxes` | 替换全部标注框 |
| PUT | `/detections/{id}/boxes/{boxId}` | 修改标注框坐标 |
| POST | `/detections/{id}/boxes/{boxId}/delete` | 删除标注框 |
| PUT | `/detections/{id}/filter-settings` | 保存过滤模式与 NMS IoU |
| POST | `/detections/{id}/delete` | 删除检测记录 |
| GET | `/detections/{id}/export` | 导出单图 YOLO 标注 |
| POST | `/detections/export-batch` | 多格式批量导出：`yolo` `yolo-seg` `coco` `voc` `createml`（zip） |

### 模型管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/model/events` | SSE 流：VLM、SAM2、SAM3 三模型状态统一推送 |
| GET | `/model/status` | VLM 模型状态（`loaded`、`state`、`progress`） |
| POST | `/model/unload` | 卸载 VLM 模型释放内存 |
| GET | `/model/sam2/status` | SAM2 模型状态（`loaded`、`state`、`progress`） |
| POST | `/model/sam2/unload` | 卸载 SAM2 模型释放内存 |
| GET | `/model/sam3/status` | SAM3 模型状态（`loaded`、`status`：`starting`/`loading`/`loaded`） |
| POST | `/model/sam3/unload` | 停止 SAM3 服务进程 |

## 视频

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/videos/upload` | 上传视频（multipart） |
| GET | `/videos` | 视频列表（分页） |
| GET | `/videos/{id}` | 视频详情（含关键帧） |
| GET | `/videos/{id}/file` | 视频文件下载 |
| POST | `/videos/{id}/extract-keyframes` | 提取关键帧 |
| GET | `/videos/{id}/keyframes/{keyframeId}/image` | 关键帧图片 |
| POST | `/videos/{id}/delete` | 删除视频及关键帧 |

## 训练

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/train/jobs` | 创建训练任务（检测/分割，train/val 拆分） |
| GET | `/train/jobs` | 训练任务列表（分页） |
| GET | `/train/variants` | 可用 YOLO 系列 |
| GET | `/train/jobs/{id}` | 训练任务详情 |
| GET | `/train/jobs/{id}/progress` | 训练进度快照（JSON） |
| GET | `/train/jobs/{id}/progress/stream` | SSE 训练进度 |
| GET | `/train/jobs/{id}/download` | 下载 PT 模型 |
| GET | `/train/jobs/{id}/dataset` | 下载数据集 zip |
| GET | `/train/jobs/{id}/charts/{name}` | 训练曲线图（results.png 等） |
| POST | `/train/jobs/{id}/export-onnx` | 导出 / 下载 ONNX 模型 |
| POST | `/train/jobs/{id}/predict` | YOLO 推理（图片） |
| POST | `/train/jobs/{id}/retrain` | 使用相同设置重新训练 |
| GET | `/train/jobs/{id}/validate-mjpeg/{video_id}` | 视频验证（MJPEG 实时流） |
| POST | `/train/jobs/{id}/predict-video-stream` | 视频验证（SSE 流） |
| POST | `/train/jobs/{id}/predict-video` | 视频验证（同步批量） |
| POST | `/train/jobs/{id}/cancel` | 取消待处理/运行中的训练任务 |
| POST | `/train/jobs/{id}/delete` | 删除训练任务 |
| POST | `/train/upload-model` | 上传外部 YOLO 模型 (.pt) → Token |
| POST | `/train/validate-image/{token}` | 外部模型验证图片 |
| GET | `/train/validate-mjpeg/{token}/{video_id}` | 外部模型验证视频（MJPEG） |

## 数据集导入

| 方法 | 路径 | 说明 |
|--------|------|-------------|
| POST | `/datasets/import` | 直接上传（≤200MB ZIP），后台启动导入 |
| POST | `/datasets/import/chunk/init` | 创建/续传分片上传会话，最大 10GB |
| POST | `/datasets/import/chunk/{id}/{n}` | 上传分片 `n`（二进制 body） |
| GET | `/datasets/import/chunk/{id}` | 查看上传状态（已上传分片列表） |
| POST | `/datasets/import/chunk/{id}/complete` | 合并分片 → 启动导入 |
| POST | `/datasets/import/chunk/{id}/cancel` | 取消上传 / 清理分片 |
| GET | `/datasets/import/{importId}/progress` | 导入进度 |
| POST | `/datasets/import/{importId}/cancel` | 取消正在进行的导入 |

支持 5 种格式：`yolo`、`yolo-seg`、`coco`、`voc`、`createml`。

## 响应格式

```json
// 单条：200/201
{ "data": { "id": "...", "imageName": "...", "createdAt": "..." } }

// 列表：200
{ "data": [...], "total": 100, "page": 1, "pageSize": 20 }

// 删除：204（空响应体）

// 错误：4xx/5xx
{ "error": { "code": "NotFoundError", "message": "检测记录不存在: xxx" } }
```

### 检测对象

列表接口返回轻量 boxes（不含 `maskPolygon`），详情接口包含完整 mask 数据。
`modelType`：`"vlm"` / `"vlm+sam2"` / `"sam3"`。

```json
{
  "id": "uuid",
  "imageName": "cat.jpg",
  "categories": ["cat"],
  "modelName": "LocateAnything-3B",
  "modelType": "sam3",
  "imageWidth": 1024,
  "imageHeight": 768,
  "elapsedMs": 4500,
  "filterMode": "all",
  "filterNmsIou": null,
  "status": "completed",
  "createdAt": "2026-06-05T12:00:00+08:00",
  "boxes": [
    {
      "id": "uuid",
      "className": "cat",
      "x1": 100, "y1": 200, "x2": 300, "y2": 400,
      "confidence": null,
      "maskPolygon": [[110,210], [115,220], ...]
    }
  ]
}
```

### 训练任务对象

```json
{
  "id": "uuid",
  "modelVariant": "yolo26n",
  "epochs": 100,
  "imgsz": 640,
  "batch": 16,
  "trainRatio": 0.7,
  "valRatio": 0.2,
  "taskType": "detect",
  "status": "completed",
  "metrics": {
    "mAP50": 0.85,
    "mAP50-95": 0.62,
    "precision": 0.88,
    "recall": 0.82,
    "num_samples": 50,
    "num_classes": 3
  },
  "modelPath": "/path/to/model.pt",
  "onnxPath": "/path/to/model.onnx",
  "errorMessage": null,
  "createdAt": "2026-06-05T12:00:00+08:00",
  "completedAt": "2026-06-05T12:05:00+08:00",
  "detectionIds": ["uuid1", "uuid2"]
}
```

## 导出格式

批量导出（`POST /detections/export-batch`）返回 zip 包，结构因格式而异：

| 格式 | 文件结构 |
|------|---------|
| `yolo` | `images/*.{jpg,png}`, `labels/*.txt`, `data.yaml` |
| `yolo-seg` | 同上，标注使用多边形格式（`class_id x1 y1 x2 y2 ...`） |
| `coco` | `annotations.json`（images, annotations, categories） |
| `voc` | `*.xml`（每图一个，Pascal VOC 格式） |
| `createml` | `annotations.json`（CreateML 目标检测格式） |
