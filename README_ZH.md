# AutoLabeling

[English](README.md) | 简体中文

基于 NVIDIA LocateAnything-3B 视觉大模型驱动的端到端**预标注训练系统**。

> 图片扔进去，模型训出来 — VLM 自动定位标注 + 人工修正 + 一键 YOLO 训练 + 模型验证，全流程闭环。

**核心流程**：VLM 预标注 → 手动修正 → 导出数据集 → YOLO 训练 → 模型验证

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
| 目标检测 | YOLOv5 / v8 / v11 / v26（Ultralytics） |
| 后端 | Python FastAPI + PostgreSQL + SSE |
| 前端 | React + TypeScript + Vite + Tailwind CSS + antd |
| 状态管理 | TanStack Query + ahooks |
| 视频处理 | ffmpeg（场景检测 / 运动检测 / 间隔提取） |
| 工程化 | pnpm、ESLint、Prettier |

## 快速开始

### 环境要求

| 资源 | 最低配置 |
|------|---------|
| Python | 3.12+ |
| Node.js | 22+ |
| PostgreSQL | 16+ |
| ffmpeg | 任意版本 |
| macOS | Apple Silicon 24GB 统一内存 |
| NVIDIA GPU | 10GB 显存 |
| CPU 模式 | 16GB 系统内存 |

### 安装

```bash
# 1. 克隆仓库
git clone https://github.com/Somnusochi/AutoLabeling.git
cd AutoLabeling

# 2. 后端
cd backend
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd ..

# 3. 前端
cd frontend
pnpm install
cd ..

# 4. 数据库
psql -d postgres -c "CREATE DATABASE autolabeling;"

# 5. 配置
cp backend/.env.example backend/.env

# 6. 数据库迁移
cd backend
PYTHONPATH=. alembic upgrade head
```

### 下载模型（可选）

```bash
# 首次运行会自动下载，网络慢可预下载
huggingface-cli download nvidia/LocateAnything-3B --local-dir backend/model
```

### 启动

```bash
# macOS / Linux
./start.sh

# Windows
start.bat
```

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:5173 |
| 后端 | http://localhost:8000 |
| API 文档 | http://localhost:8000/docs |

### Docker

```bash
docker compose up -d
```

## 项目结构

```
AutoLabeling/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py              # 依赖注入
│   │   │   └── routes/              # REST API
│   │   │       ├── detection.py     # 检测 CRUD、手动标注
│   │   │       ├── export.py        # YOLO 格式导出
│   │   │       ├── train.py         # 训练、SSE、验证
│   │   │       └── video.py         # 视频上传、关键帧提取
│   │   ├── core/                    # 配置、数据库、中间件、日志
│   │   ├── models/                  # SQLAlchemy ORM
│   │   │   ├── detection.py         # 检测 & 标注框
│   │   │   ├── train.py             # 训练任务
│   │   │   └── video.py             # 视频 & 关键帧
│   │   ├── repositories/            # 数据访问层
│   │   ├── schemas/                 # Pydantic 模型（驼峰命名）
│   │   ├── services/
│   │   │   ├── box_filter.py        # 标注框过滤、NMS 去重
│   │   │   ├── locate_anything.py   # VLM 推理引擎
│   │   │   ├── video_service.py     # ffmpeg 关键帧提取 + SSIM 去重
│   │   │   ├── trainer.py           # YOLO 训练 + 验证
│   │   │   ├── export.py            # 标注导出
│   │   │   └── yolo_format.py       # YOLO 格式转换
│   │   └── main.py                  # FastAPI 入口
│   ├── alembic/                     # 数据库迁移
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/              # UI 组件
│       │   ├── DetectionCanvas.tsx  # 图片标注画布
│       │   ├── DetectionResult.tsx  # 检测结果展示
│       │   ├── VideoPanel.tsx       # 视频上传与关键帧时间轴
│       │   ├── VideoDetail.tsx      # 关键帧详情
│       │   ├── KeyframeGrid.tsx     # 关键帧网格
│       │   ├── TrainingPanel.tsx    # YOLO 训练面板
│       │   └── ...
│       ├── pages/Home.tsx           # 主页面（图片/视频双模式）
│       ├── hooks/                   # 自定义 Hooks
│       ├── services/api.ts          # 统一 API 层（驼峰命名）
│       ├── lib/                     # 常量、工具函数
│       └── types/                   # TypeScript 类型
├── docs/                            # 截图
├── docker-compose.yml
├── start.sh / start.bat             # 启动脚本
└── README.md
```

## 功能

### VLM 预标注

上传图片或视频关键帧，输入目标描述（如 `fire, smoke`、`Monster Energy drink`），LocateAnything-3B 自动检测并绘制边界框。

- 支持任意开放词汇描述，英文短语效果最佳
- 图片自动压缩至安全分辨率，防止显存溢出
- 支持文件夹 / 视频关键帧批量上传，流式返回结果
- 流式处理：第一张结果立即可见，后续结果实时追加

### 视频标注

上传视频，智能提取关键帧，挑选后批量标注。

- **三种提取方式**：场景切换检测、运动检测（光流法）、固定间隔
- **SSIM 去重**：自动去除相似帧，阈值可调
- **时间轴预览**：水平时间轴浏览所有关键帧，点击可看大图
- **多选机制**：勾选需要标注的帧，全选 / 取消全选，加载选中帧到标注队列
- 关键帧加载后走标准 VLM 预标注流程，与图片标注体验一致

### 手动标注

Canvas 画框模式，自由绘制边界框。

- 查看/标注双模式切换
- 画框前选择类别，历史类别快速填充
- VLM 预标注 → 删错框 → 补漏框，协同工作
- 支持"全部 / 最优 / NMS 去重"过滤模式
- 过滤设置可保存到检测记录，后端导出和训练会使用保存后的过滤结果
- 支持临时隐藏单个标注框，便于检查密集检测结果
- 单帧重新检测

### 历史管理

- 缩略图 + 类别标签展示
- 按标签多选筛选
- 点击查看详情，支持重新检测
- 批量/单张导出 YOLO 格式标注文件
- 单图支持浏览器端 `.txt` 快速导出；批量导出使用后端 zip
- 保存过滤结果后历史列表实时更新

### YOLO 训练

- 多系列可选：YOLOv5 / v8 / v11 / v26（n/s/m/l/x）
- 标签筛选 + 缩略图预览，精确选择训练数据
- 数据集拆分：预设比例（70/20/10、80/20 等），自动分 train/val/test
- 一键训练，SSE 实时推送 Epoch / Loss / mAP 进度
- 训练完成自动导出 ONNX，可下载 PT / ONNX 模型和数据集 zip
- 训练曲线图表（results.png）可在详情模态框中查看
- 训练任务与检测记录使用独立关联表保存，支持 JSONB 指标与类别映射
- 训练数据生成会应用检测记录中保存的过滤模式

### 模型验证

- **双模型源支持**：支持使用训练出的 YOLO 模型，或手动上传本地外部 YOLO 模型（`.pt` 文件）进行推理验证
- **Conf / IoU 调节**：支持置信度阈值 (Conf) 与重叠阈值 (IoU) 滑块实时微调框过滤效果
- **图片多图批量验证**：支持对选中的多张测试图片进行批处理验证，置信度及边界框一目了然
- **视频实时流推理验证**：
  - 基于 MJPEG 的帧级 YOLO 实时推理流（逐帧自动检测并渲染覆盖层）
  - 支持点击视频画面暂停/恢复播放，暂停时通过 Canvas 保持当前帧的毛玻璃效果状态，无闪烁
  - 视频播放完毕自动呈现“播放完成，点击重播”毛玻璃覆盖层
  - 底栏右侧提供“重新播放”按钮，防浏览器缓存一键重新拉流推理验证
  - 容器固定 16:9 比例自适应（aspect-video），消除所有加载和切换时的画面尺寸收缩与抖动
- 验证结果是临时结果，可直接导出单图 YOLO `.txt` 标注文件

## API 概览

所有响应字段使用驼峰命名（camelCase），错误响应携带正确的 HTTP 状态码。

### 检测与标注

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/detect` | VLM 预标注（multipart） |
| GET | `/api/v1/detections` | 历史列表（分页，返回 `data` + `total` + `page` + `pageSize`） |
| GET | `/api/v1/detections/{id}` | 检测详情 |
| GET | `/api/v1/detections/{id}/image` | 检测原图 |
| POST | `/api/v1/detections/{id}/boxes` | 手动添加标注框 |
| PUT | `/api/v1/detections/{id}/boxes` | 替换检测记录的全部标注框 |
| PUT | `/api/v1/detections/{id}/boxes/{boxId}` | 修改标注框坐标 |
| POST | `/api/v1/detections/{id}/boxes/{boxId}/delete` | 删除标注框 |
| PUT | `/api/v1/detections/{id}/filter-settings` | 保存过滤模式与 NMS IoU |
| POST | `/api/v1/detections/{id}/delete` | 删除检测记录 |
| GET | `/api/v1/detections/{id}/export` | 导出单图 YOLO 标注 |
| POST | `/api/v1/detections/export-batch` | 批量导出（zip） |

### 视频

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/videos/upload` | 上传视频（multipart） |
| GET | `/api/v1/videos` | 视频列表（分页） |
| GET | `/api/v1/videos/{id}` | 视频详情（含关键帧） |
| POST | `/api/v1/videos/{id}/extract-keyframes` | 提取关键帧 |
| GET | `/api/v1/videos/{id}/keyframes/{keyframeId}/image` | 关键帧图片 |
| POST | `/api/v1/videos/{id}/delete` | 删除视频及关键帧 |

### 训练

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/train/jobs` | 创建训练任务（支持 trainRatio/valRatio 拆分、taskType） |
| GET | `/api/v1/train/jobs` | 训练任务列表（分页） |
| GET | `/api/v1/train/variants` | 可用 YOLO 系列 |
| GET | `/api/v1/train/jobs/{id}/progress/stream` | SSE 训练进度 |
| GET | `/api/v1/train/jobs/{id}/download` | 下载 PT 模型 |
| GET | `/api/v1/train/jobs/{id}/dataset` | 下载数据集 zip（images + labels + data.yaml） |
| GET | `/api/v1/train/jobs/{id}/charts/{name}` | 训练曲线图（results.png 等） |
| POST | `/api/v1/train/jobs/{id}/export-onnx` | 导出 / 下载 ONNX 模型 |
| POST | `/api/v1/train/jobs/{id}/predict` | YOLO 模型推理验证 |
| POST | `/api/v1/train/jobs/{id}/delete` | 删除训练任务 |
| POST | `/api/v1/train/upload-model` | 上传外部本地 YOLO 模型 (.pt) 并获取 Token |
| POST | `/api/v1/train/validate-image/{token}` | 使用外部模型验证图片 |
| GET | `/api/v1/train/validate-mjpeg/{token}/{video_id}` | 使用外部模型验证视频（MJPEG 实时流） |

### 响应格式

**成功（单条）** → `200/201`：
```json
{ "data": { "id": "...", "fileName": "...", "createdAt": "..." } }
```

**成功（列表）** → `200`：
```json
{ "data": [...], "total": 100, "page": 1, "pageSize": 20 }
```

**成功（删除）** → `204`（空响应体）

**错误** → `4xx/5xx`：
```json
{ "error": { "code": "NotFoundError", "message": "Video not found: xxx" } }
```

## 跨平台

| 平台 | 推理后端 | 训练后端 |
|------|---------|---------|
| macOS (Apple Silicon) | MPS | MPS |
| Linux / Windows (NVIDIA) | CUDA | CUDA |
| 无 GPU | CPU | CPU |

设备自动检测，优先级：CUDA → MPS → CPU。可通过 `DEVICE` 环境变量手动指定。

## 开发与校验

```bash
# 前端
cd frontend
pnpm install
pnpm run lint
pnpm run build

# 后端
cd backend
source .venv/bin/activate
PYTHONPATH=. alembic upgrade head
python -m compileall app alembic
```

## License

本项目代码 [MIT](LICENSE)。

LocateAnything-3B 模型遵循 [NVIDIA License](https://huggingface.co/nvidia/LocateAnything-3B/blob/main/LICENSE)（非商用）。
