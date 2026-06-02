# AutoLabeling

[English](README_EN.md) | 中文

基于 NVIDIA LocateAnything-3B 视觉大模型驱动的端到端**预标注训练系统**。

> 图片扔进去，模型训出来 — VLM 自动定位标注 + 人工修正 + 一键 YOLO 训练 + 模型验证，全流程闭环。

**核心流程**：VLM 预标注 → 手动修正 → 导出数据集 → YOLO 训练 → 模型验证

## 截图

| VLM 预标注 | 手动标注与训练 |
|-----------|-------------|
| ![预标注](docs/1.png) | ![训练](docs/2.png) |

| 模型验证 |
|---------|
| ![验证](docs/3.png) |

## 技术栈

| 层 | 技术 |
|---|------|
| 视觉定位 | NVIDIA LocateAnything-3B（Qwen2.5-3B + MoonViT） |
| 目标检测 | YOLOv5 / v8 / v11 / v26（Ultralytics） |
| 后端 | Python FastAPI + PostgreSQL + SSE |
| 前端 | React + TypeScript + Vite + Tailwind CSS |
| 状态管理 | TanStack Query + ahooks |
| 工程化 | unplugin-auto-import、ESLint、Prettier |

## 快速开始

### 环境要求

| 资源 | 最低配置 |
|------|---------|
| Python | 3.12+ |
| Node.js | 20+ |
| PostgreSQL | 16+ |
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

# 3. 前端
cd ../frontend
npm install

# 4. 数据库
psql -d postgres -c "CREATE DATABASE locate_anything;"

# 5. 配置
cp backend/.env.example backend/.env
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
│   │   │       └── train.py         # 训练、SSE、验证
│   │   ├── core/                    # 配置、数据库、中间件、日志
│   │   ├── models/                  # SQLAlchemy ORM
│   │   ├── repositories/            # 数据访问层
│   │   ├── schemas/                 # Pydantic 模型
│   │   ├── services/
│   │   │   ├── locate_anything.py   # VLM 推理引擎
│   │   │   ├── trainer.py           # YOLO 训练 + 验证
│   │   │   ├── export.py            # 标注导出
│   │   │   └── yolo_format.py       # YOLO 格式转换
│   │   └── main.py                  # FastAPI 入口
│   ├── alembic/                     # 数据库迁移
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/              # UI 组件
│       ├── pages/Home.tsx           # 主页面
│       ├── hooks/                   # 自定义 Hooks
│       │   ├── useDetection.ts
│       │   ├── useBatchDetection.ts
│       │   └── useYoloValidation.ts
│       ├── services/api.ts          # 统一 API 层
│       ├── lib/                     # 常量、工具函数
│       ├── types/                   # TypeScript 类型
│       └── main.tsx                 # 入口
├── docs/                            # 截图
├── docker-compose.yml
├── start.sh / start.bat             # 启动脚本
└── README.md
```

## 功能

### VLM 预标注

上传图片，输入目标描述（如 `fire, smoke`、`Monster Energy drink`），LocateAnything-3B 自动检测并绘制边界框。

- 支持任意开放词汇描述，英文短语效果最佳
- 图片自动压缩至安全分辨率，防止显存溢出
- 支持文件夹批量上传，串行处理

### 手动标注

Canvas 画框模式，自由绘制边界框。

- 查看/标注双模式切换
- 画框前选择类别，历史类别快速填充
- VLM 预标注 → 删错框 → 补漏框，协同工作

### 历史管理

- 缩略图 + 类别标签展示
- 按标签多选筛选
- 点击查看详情，支持重新检测
- 批量/单张导出 YOLO 格式标注文件

### YOLO 训练

- 多系列可选：YOLOv5 / v8 / v11 / v26（n/s/m/l/x）
- 标签筛选 + 缩略图预览，精确选择训练数据
- 一键训练，SSE 实时推送 Epoch / Loss / mAP 进度
- 训练完成后下载 `.pt` 模型文件

### 模型验证

- 用训练好的 YOLO 模型推理新图片
- Conf / IoU 可调节
- 可预览标注框效果，置信度一目了然

## API 概览

### 检测与标注

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/detect` | VLM 预标注（multipart） |
| GET | `/api/v1/detections` | 历史列表（分页） |
| GET | `/api/v1/detections/{id}` | 检测详情 |
| GET | `/api/v1/detections/{id}/image` | 检测原图 |
| POST | `/api/v1/detections/{id}/boxes` | 手动添加标注框 |
| PUT | `/api/v1/detections/{id}/boxes/{box_id}` | 修改标注框坐标 |
| POST | `/api/v1/detections/{id}/boxes/{box_id}/delete` | 删除标注框 |
| POST | `/api/v1/detections/{id}/delete` | 删除检测记录 |
| GET | `/api/v1/detections/{id}/export` | 导出单图 YOLO 标注 |
| POST | `/api/v1/detections/export-batch` | 批量导出（zip） |

### 训练

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/train/jobs` | 创建训练任务 |
| GET | `/api/v1/train/jobs` | 训练任务列表 |
| GET | `/api/v1/train/variants` | 可用 YOLO 系列 |
| GET | `/api/v1/train/jobs/{id}/progress/stream` | SSE 训练进度 |
| POST | `/api/v1/train/jobs/{id}/predict` | YOLO 模型推理验证 |
| POST | `/api/v1/train/jobs/{id}/delete` | 删除训练任务 |

## 跨平台

| 平台 | 推理后端 | 训练后端 |
|------|---------|---------|
| macOS (Apple Silicon) | MPS | MPS |
| Linux / Windows (NVIDIA) | CUDA | CUDA |
| 无 GPU | CPU | CPU |

设备自动检测，优先级：CUDA → MPS → CPU。可通过 `DEVICE` 环境变量手动指定。

## License

本项目代码 [MIT](LICENSE)。

LocateAnything-3B 模型遵循 [NVIDIA License](https://huggingface.co/nvidia/LocateAnything-3B/blob/main/LICENSE)（非商用）。
