# VLM-AutoYOLO

[English](README.md) | 简体中文

**端到端目标检测自动标注与 YOLO 训练平台。** 基于 NVIDIA LocateAnything-3B 视觉大模型，支持 VLM 自动标注、SAM2.1 mask 精修、人工修正、多格式数据集导出、一键 YOLO 训练（检测 + 分割）、视频关键帧提取与模型验证。

> 图片扔进去，模型训出来 — VLM 自动标注 → SAM2 mask 精修 → 人工修正 → 多格式导出 → YOLO 训练 → 模型验证。

**完整工作流**：VLM 预标注 → SAM2 分割 → 手动修正 → 多格式导出 → YOLO 训练（检测/分割） → 模型验证

**核心功能**：
- 🤖 **VLM 自动标注**：基于 LocateAnything-3B 的开放词汇目标检测
- 🎯 **SAM2 分割**：bbox → 像素级 mask（SAM 2.1），BBox/Mask 画布独立开关
- 🎥 **视频标注**：智能关键帧提取（场景/运动/间隔），SSIM 去重
- ✏️ **人工修正**：Canvas 画框模式，NMS 过滤，单框隐藏
- 📦 **多格式导出**：YOLO、YOLO-Seg、COCO JSON、Pascal VOC XML、CreateML JSON
- 🚀 **一键训练**：YOLOv8 / v11 / v26，检测 & 分割，SSE 实时进度
- ✅ **模型验证**：批量图片/视频测试，MJPEG 实时流，SSE 视频推理
- 💾 **智能模型管理**：惰性加载，闲置自动卸载，MPS/CUDA 策略模式内存回收
- 🌐 **国际化**：中英文双语 · 🎨 **主题**：亮色/暗色模式

## 文档

📚 **[用户指南 (中文)](docs/guide/README.md)** | 📚 **[User Guide (English)](docs/guide/en/README.md)**

完整指南：快速开始、标注最佳实践、训练参数调优、模型部署。

## 截图

| VLM 预标注与人工修正 | YOLO 训练 |
|------------------|-----------|
| ![VLM 预标注与人工修正](docs/1.png) | ![YOLO 训练](docs/2.png) |

| 视频关键帧入口 | 模型验证 |
|--------------|---------|
| ![视频关键帧入口](docs/4.png) | ![模型验证](docs/3.png) |

## 技术栈

| 层 | 技术 |
|---|------|
| 视觉定位 | NVIDIA LocateAnything-3B（Qwen2.5-3B + MoonViT） |
| 分割精修 | SAM 2.1 — Segment Anything Model 2 |
| 目标检测 | YOLOv8 / v11 / v26 — 检测 & 分割（Ultralytics） |
| 后端 | Python FastAPI + PostgreSQL + SSE |
| 前端 | React + TypeScript + Vite + Tailwind CSS + antd |
| GPU 内存 | 策略模式（`gpu_memory.py`）— CUDA expandable segments / MPS synchronize + empty_cache |
| 状态管理 | TanStack Query + ahooks |
| 国际化 | i18next（中文 / 英文） |
| 视频处理 | ffmpeg（场景检测 / 运动检测 / 间隔提取） |
| 工程化 | pnpm、ESLint、Prettier |

## 快速开始

### Docker 部署

> **环境要求：** Linux 或 Windows (WSL2) + NVIDIA GPU + [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)。
> **macOS 不支持** — Docker on Mac 无 GPU 直通，请使用[手动安装](#手动安装)。

**使用预构建镜像：**

```bash
curl -O https://raw.githubusercontent.com/Somnusochi/VLM-AutoYOLO/master/docker-compose.yml
docker compose up -d
open http://localhost        # 前端
open http://localhost:8000/docs  # API 文档
```

**从源码构建：**

```bash
git clone https://github.com/Somnusochi/VLM-AutoYOLO.git
cd VLM-AutoYOLO
docker compose up -d --build
```

**服务：**

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 | 80 | React 界面（Nginx） |
| 后端 | 8000 | FastAPI 服务器 |
| 数据库 | 5432 | PostgreSQL |

**GPU 支持** — 编辑 `docker-compose.yml`：

```yaml
backend:
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
  environment:
    DEVICE: cuda
```

**持久化存储（Docker 卷）：**
- `pgdata` — 数据库 · `model-cache` — VLM 和 SAM2 模型 · `uploads` — 用户上传 · `training-data` — 训练输出

**备份/恢复：**

```bash
docker compose exec db pg_dump -U postgres autolabeling > backup.sql
cat backup.sql | docker compose exec -T db psql -U postgres autolabeling
```

### 手动安装

**环境要求：**

| 资源 | 最低配置 | 推荐配置 |
|------|---------|---------|
| Python | 3.12+ | 3.12+ |
| Node.js | 22+ | 22+ |
| PostgreSQL | 16+ | 16+ |
| ffmpeg | 任意版本 | — |
| macOS | Apple Silicon 16GB | 24GB+ |
| NVIDIA GPU | 10GB 显存 | 12GB+ |

**安装：**

```bash
git clone https://github.com/Somnusochi/VLM-AutoYOLO.git
cd VLM-AutoYOLO

# 后端
cd backend
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd ..

# 前端
cd frontend
pnpm install
cd ..

# 数据库 (PostgreSQL 推荐，但也支持 SQLite)
# 如果使用 PostgreSQL:
# psql -d postgres -c "CREATE DATABASE autolabeling;"
# cp backend/.env.example backend/.env
# 如果你想使用免安装的 SQLite 本地数据库，直接跳过上方两步，系统会自动生成 autolabeling.db

# 迁移
cd backend
PYTHONPATH=. alembic upgrade head
```

**预下载模型（可选）：**

```bash
huggingface-cli download nvidia/LocateAnything-3B --local-dir backend/model
```

**启动：**

```bash
./start.sh   # macOS / Linux
start.bat    # Windows
```

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:5173 |
| 后端 | http://localhost:8000 |
| API 文档 | http://localhost:8000/docs |

## 项目结构

```
VLM-AutoYOLO/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py              # 依赖注入
│   │   │   └── routes/
│   │   │       ├── detection.py     # 检测 CRUD、手动标注、模型管理
│   │   │       ├── export.py        # 多格式数据集导出
│   │   │       ├── predict.py       # 模型验证、视频推理（MJPEG/SSE）
│   │   │       ├── train.py         # YOLO 训练、SSE 进度、重训
│   │   │       └── video.py         # 视频上传、关键帧提取
│   │   ├── core/
│   │   │   ├── config.py            # 配置、设备检测、分配器调优
│   │   │   ├── database.py          # SQLAlchemy 引擎 + 会话
│   │   │   ├── gpu_memory.py        # GPU 内存策略（CUDA / MPS / CPU）
│   │   │   └── ...
│   │   ├── models/                  # SQLAlchemy ORM
│   │   │   ├── detection.py         # 检测 & 标注框（含 mask_polygon）
│   │   │   ├── train.py             # 训练任务（检测 & 分割）
│   │   │   └── video.py             # 视频 & 关键帧
│   │   ├── repositories/            # 数据访问层
│   │   ├── schemas/                 # Pydantic 模型（驼峰命名）
│   │   ├── services/
│   │   │   ├── box_filter.py        # 标注框过滤、NMS 去重
│   │   │   ├── locate_anything.py   # VLM 推理引擎
│   │   │   ├── sam2_service.py      # SAM2 分割服务
│   │   │   ├── trainer.py           # YOLO 训练 + 验证
│   │   │   ├── export.py            # 多格式导出分发器
│   │   │   ├── yolo_format.py       # YOLO 标签转换（bbox + seg）
│   │   │   ├── coco_format.py       # COCO JSON 导出
│   │   │   ├── voc_format.py        # Pascal VOC XML 导出
│   │   │   ├── createml_format.py   # CreateML JSON 导出
│   │   │   ├── video_service.py     # ffmpeg 关键帧提取 + SSIM 去重
│   │   │   └── frame_utils.py       # 帧预测与标注绘制
│   │   └── main.py                  # FastAPI 入口
│   ├── alembic/                     # 数据库迁移
│   ├── requirements.txt
│   └── pyproject.toml
├── frontend/
│   └── src/
│       ├── components/              # React UI 组件
│       │   ├── DetectionCanvas.tsx  # 图片标注画布（bbox + mask）
│       │   ├── DetectionResult.tsx  # 检测结果（多格式导出）
│       │   ├── TrainingPanel.tsx    # YOLO 训练面板（检测 & 分割，数据集下载）
│       │   ├── HistoryList.tsx      # 检测历史（分页 + 导出下拉菜单）
│       │   ├── HistoryListItem.tsx  # 历史记录单项卡片
│       │   ├── ResultTable.tsx      # 结果表格（含 Mask 列）
│       │   ├── training/            # YOLO 训练子组件
│       │   │   ├── TrainingCandidateList.tsx
│       │   │   ├── CandidateListItem.tsx
│       │   │   ├── TrainingJobItem.tsx
│       │   │   ├── TrainingPreview.tsx
│       │   │   └── StatusBadge.tsx
│       │   ├── Sidebar.tsx          # 主侧边栏（SAM2 开关、检测、训练）
│       │   ├── VideoPanel.tsx       # 视频上传与关键帧时间轴
│       │   ├── VideoValidator.tsx   # 视频验证
│       │   ├── ModelSelector.tsx    # YOLO 模型选择器
│       │   ├── ValidationSettings.tsx # Conf/IoU 阈值控制
│       │   ├── ImageUploader.tsx    # 拖拽上传
│       │   ├── CategoryInput.tsx    # 类别快速填充
│       │   ├── FilterPanel.tsx      # 过滤模式选择
│       │   ├── BatchProgress.tsx    # 批量标注进度
│       │   ├── KeyframeGrid.tsx     # 视频关键帧网格
│       │   ├── ThemeProvider.tsx    # 亮色/暗色主题
│       │   ├── Layout.tsx           # 应用布局
│       │   └── ...
│       ├── pages/Home.tsx           # 主页面
│       ├── hooks/                   # 自定义 Hooks（useHomeState, useBatchDetection, ...）
│       ├── i18n/locales/            # en.json、zh.json
│       ├── services/api.ts          # 统一 API 层
│       ├── lib/                     # 常量、过滤器、解析器、yoloExport
│       └── types/index.ts           # TypeScript 类型（BBox, Detection, TrainingJob）
├── docs/                            # 截图与用户指南
├── docker-compose.yml
├── start.sh / start.bat
└── README.md
```

## 功能

### VLM 预标注

上传图片或视频关键帧，输入开放词汇描述（如 `fire, smoke`、`红色汽车`），LocateAnything-3B 自动检测并绘制边界框。

- 开放词汇自然语言描述
- 按长边自动缩放（根据 VRAM：800–1333px）
- 批量上传文件夹或视频关键帧，流式返回

### SAM2 分割

VLM 检测出 bbox 后，可启用 SAM2 自动生成像素级 mask 轮廓。

- 勾选「启用 SAM2 分割」后自动运行
- SAM 2.1 模型（base+），惰性加载，闲置自动卸载
- mask 半透明叠加在画布上，bbox 和 mask 独立开关
- 结果表格显示每个目标的 mask 顶点数，预览浮窗同步渲染

### 视频标注

上传视频，智能提取关键帧，挑选后批量标注。

- **三种提取方式**：场景切换、运动检测（光流法）、固定间隔
- **SSIM 去重**：自动去除相似帧
- **时间轴预览**：水平滑动浏览，点击放大
- **多选机制**：勾选帧、全选/取消全选、加载到标注队列

### 手动标注

Canvas 画框模式，查看/标注双模式切换。

- 历史类别快速填充
- VLM 预标注打底 → 删错框 → 补漏框
- 全部 / 最优 / NMS 去重过滤，设置可保存
- 临时隐藏单框，密集检测结果检查
- 单帧重新检测

### 历史管理

- 缩略图 + 类别标签，按标签多选筛选
- 点击查看详情，支持重新检测，前端分页
- 单张/批量导出 **5 种格式**：YOLO、YOLO-Seg、COCO JSON、Pascal VOC XML、CreateML JSON
- 下拉菜单选格式，一键下载 zip

### YOLO 训练

- **系列**：YOLOv8 / v11 / v26（n/s/m/l/x）
- **任务类型**：目标检测（Detect）、实例分割（Segment）
- 分割训练自动使用 SAM2 polygon 标签，无 polygon 时 fallback 到 bbox
- 标签筛选 + 缩略图预览精确选择训练数据
- 数据集拆分预设（70/20/10、80/20、90/10、60/20/20）
- SSE 实时推送：Epoch / Loss / mAP50
- 自动 ONNX 导出，可下载 PT / ONNX / 数据集 zip

### 模型验证

- **双模型源**：训练模型或外部上传 `.pt` 文件
- **Conf / IoU 滑块**实时调节阈值
- **图片批量验证**，显示边界框和置信度
- **视频验证**（三种模式）：
  - MJPEG 实时流，支持交互式暂停
  - SSE 预测流，逐帧 JSON 事件
  - 同步批量预测，一次性返回全部结果
- 临时结果，可导出 YOLO `.txt` 标注

### 模型管理

- **惰性加载**：VLM 和 SAM2 首次使用自动加载，闲置超时自动卸载（默认 10 分钟）
- **闲置看门狗**：通过 `MODEL_IDLE_TIMEOUT_SECONDS` 可配置
- **状态/卸载 API**：`GET /api/v1/model/status`、`POST /api/v1/model/unload`
- **GPU 内存**：策略模式（`gpu_memory.py`）— CUDA `expandable_segments` / MPS `synchronize`+`empty_cache`+`gc`

## API 概览

所有字段驼峰命名。错误携带正确 HTTP 状态码。

### 检测与标注

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/detect` | VLM 预标注（multipart，支持 `use_sam2` 参数） |
| GET | `/api/v1/detections` | 历史列表（分页） |
| GET | `/api/v1/detections/{id}` | 检测详情 |
| GET | `/api/v1/detections/{id}/image` | 检测原图 |
| POST | `/api/v1/detections/{id}/boxes` | 手动添加标注框 |
| PUT | `/api/v1/detections/{id}/boxes` | 替换全部标注框 |
| PUT | `/api/v1/detections/{id}/boxes/{boxId}` | 修改标注框坐标 |
| POST | `/api/v1/detections/{id}/boxes/{boxId}/delete` | 删除标注框 |
| PUT | `/api/v1/detections/{id}/filter-settings` | 保存过滤模式与 NMS IoU |
| POST | `/api/v1/detections/{id}/delete` | 删除检测记录 |
| GET | `/api/v1/detections/{id}/export` | 导出单图 YOLO 标注 |
| POST | `/api/v1/detections/export-batch` | 多格式批量导出：`yolo` `yolo-seg` `coco` `voc` `createml`（zip） |
| GET | `/api/v1/model/status` | VLM 模型状态 |
| POST | `/api/v1/model/unload` | 卸载 VLM 模型 |

### 视频

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/videos/upload` | 上传视频 |
| GET | `/api/v1/videos` | 视频列表（分页） |
| GET | `/api/v1/videos/{id}` | 视频详情（含关键帧） |
| GET | `/api/v1/videos/{id}/file` | 视频文件下载 |
| POST | `/api/v1/videos/{id}/extract-keyframes` | 提取关键帧 |
| GET | `/api/v1/videos/{id}/keyframes/{keyframeId}/image` | 关键帧图片 |
| POST | `/api/v1/videos/{id}/delete` | 删除视频及关键帧 |

### 训练

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/train/jobs` | 创建训练任务（检测/分割，train/val 拆分） |
| GET | `/api/v1/train/jobs` | 训练任务列表（分页） |
| GET | `/api/v1/train/variants` | 可用 YOLO 系列 |
| GET | `/api/v1/train/jobs/{id}/progress/stream` | SSE 训练进度 |
| GET | `/api/v1/train/jobs/{id}/download` | 下载 PT 模型 |
| GET | `/api/v1/train/jobs/{id}/dataset` | 下载数据集 zip |
| GET | `/api/v1/train/jobs/{id}/charts/{name}` | 训练曲线图 |
| POST | `/api/v1/train/jobs/{id}/export-onnx` | 导出 ONNX 模型 |
| POST | `/api/v1/train/jobs/{id}/predict` | YOLO 推理（图片） |
| POST | `/api/v1/train/jobs/{id}/retrain` | 同设置重新训练 |
| GET | `/api/v1/train/jobs/{id}/validate-mjpeg/{video_id}` | 视频验证（MJPEG） |
| POST | `/api/v1/train/jobs/{id}/predict-video-stream` | 视频验证（SSE） |
| POST | `/api/v1/train/jobs/{id}/predict-video` | 视频验证（同步批量） |
| POST | `/api/v1/train/jobs/{id}/delete` | 删除训练任务 |
| POST | `/api/v1/train/upload-model` | 上传外部模型 (.pt) |
| POST | `/api/v1/train/validate-image/{token}` | 外部模型验证图片 |
| GET | `/api/v1/train/validate-mjpeg/{token}/{video_id}` | 外部模型验证视频（MJPEG） |

### 响应格式

```json
{ "data": { ... } }                                    // 单条：200/201
{ "data": [...], "total": 100, "page": 1, "pageSize": 20 }  // 列表：200
// 删除：204（空响应体）
{ "error": { "code": "NotFoundError", "message": "..." } }   // 错误：4xx/5xx
```

## 跨平台

| 平台 | 推理后端 | 训练后端 |
|------|---------|---------|
| macOS (Apple Silicon) | MPS | MPS |
| Linux / Windows (NVIDIA) | CUDA | CUDA |

自动检测：CUDA → MPS。可通过 `DEVICE` 环境变量覆盖。**不支持 CPU。**

## 推理性能基准

### Windows 11 + RTX 3080 10GB (CUDA)

7 张猫图，各 3 轮，`max_new_tokens=512`，长边 800px。

| 模式 | 图片尺寸 | 平均耗时 | 稳定平均* |
|------|---------|---------|----------|
| VLM only | 大图 (800×640) | 1.0s | **1.0s** |
| VLM only | 缩略图 | 367ms | **367ms** |
| VLM + SAM2 | 大图 (800×640) | 3.4s | **3.4s** |
| VLM + SAM2 | 缩略图 | 475ms | **475ms** |

> *排除第 1 轮第 1 张（模型加载 ~22s）。**显存**：~5.5GB 加载后，~7.5GB 峰值。

### macOS Apple Silicon 24GB (MPS)

13 张猫图，各 3 轮，`max_new_tokens=512`，长边 1024px。

| 模式 | 冷启动 | 热启动 (R2) | 热启动 (R3) | 热启动平均 |
|------|--------|------------|------------|-----------|
| VLM + SAM2 | 13.8s | 4.9s | 4.9s | **4.9s/张** |
| VLM only | 3.7s | 4.3s | 4.3s | **4.3s/张** |

> 冷启动含 VLM + SAM2 模型加载（~14s）。SAM2 额外开销：+0.65s (15%)。Mask：13/13。
> **内存**：6 轮全程 9.8–13GB 稳定，每次检测后 MPS 清理生效。

## 项目亮点

- **MPS / CUDA 全链路 GPU 加速** — VLM 推理、SAM2 分割、YOLO 训练均跑 GPU
- **策略模式 GPU 内存管理** — `gpu_memory.py` 统一 CUDA / MPS 清理；`expandable_segments:True`
- **SAM2 mask 精修** — bbox 转像素级 polygon，BBox/Mask 画布独立开关
- **5 种导出格式** — YOLO、YOLO-Seg、COCO、Pascal VOC、CreateML
- **检测 & 分割训练** — SAM2 polygon 标签自动用于分割训练
- **跨平台** — macOS MPS、Windows / Linux CUDA，统一代码库
- **智能模型生命周期** — 惰性加载、闲置自动卸载、后台下载带进度

## 开发与校验

```bash
# 前端
cd frontend && pnpm install && pnpm run lint && pnpm run build

# 后端
cd backend && source .venv/bin/activate
PYTHONPATH=. alembic upgrade head
python -m compileall app alembic
```

## License

本项目代码 [MIT](LICENSE)。LocateAnything-3B 模型遵循 [NVIDIA License](https://huggingface.co/nvidia/LocateAnything-3B/blob/main/LICENSE)（非商用）。
