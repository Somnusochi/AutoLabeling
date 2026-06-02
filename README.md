# AutoLabeling

基于 NVIDIA LocateAnything-3B 视觉大模型 + YOLOv5/v8/v11/v26 的端到端预标注训练系统。

**核心流程**：图片 → VLM 预标注 → 人工修正 → 导出 YOLO 数据集 → 训练 → 验证

![VLM预标注](docs/1.png)

![手动标注与训练](docs/2.png)

![模型验证](docs/3.png)

## 技术栈

| 层 | 技术 |
|---|------|
| 视觉定位 | NVIDIA LocateAnything-3B（Qwen2.5-3B + MoonViT） |
| 目标检测 | YOLOv5/v8/v11/v26（Ultralytics） |
| 后端 | Python FastAPI + PostgreSQL + SSE |
| 前端 | React + TypeScript + Vite + Tailwind CSS |
| 状态管理 | TanStack Query + ahooks |
| 工程化 | unplugin-auto-import |

## 快速开始

### 环境要求

- Python 3.12+
- Node.js 20+
- PostgreSQL 16+
- 内存/显存：macOS 24GB 统一内存 / NVIDIA 10GB 显存 / CPU 模式 16GB 内存
- 推理：CUDA / MPS / CPU 自动检测（macOS / Windows / Linux）

### 1. 安装依赖

```bash
# 后端
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 前端
cd ../frontend
npm install
```

### 2. 创建数据库

```bash
psql -d postgres -c "CREATE DATABASE locate_anything;"
```

### 3. 配置环境变量

```bash
cp backend/.env.example backend/.env
# 按需修改 DATABASE_URL、DEVICE 等
```

### 4. 下载模型（可选，首次运行自动下载）

```bash
.venv/bin/hf download nvidia/LocateAnything-3B --local-dir backend/model
```

### 5. 启动

```bash
./start.sh
```

- 前端：http://localhost:5173
- 后端：http://localhost:8000
- API 文档：http://localhost:8000/docs

## 项目结构

```
AutoLabeling/
├── backend/
│   ├── app/
│   │   ├── api/deps.py          # 依赖注入
│   │   ├── api/routes/          # REST API 路由
│   │   │   ├── detection.py     # 检测 CRUD、手动标注
│   │   │   ├── export.py        # YOLO 格式导出
│   │   │   └── train.py         # 训练任务、SSE 进度、模型验证
│   │   ├── core/                # 配置、数据库、中间件、日志、异常
│   │   ├── models/              # SQLAlchemy ORM (Detection, TrainingJob)
│   │   ├── repositories/        # 数据访问层
│   │   ├── schemas/             # Pydantic 请求/响应模型
│   │   ├── services/            # 业务逻辑
│   │   │   ├── locate_anything.py  # VLM 模型推理
│   │   │   ├── trainer.py          # YOLO 训练 + 验证
│   │   │   ├── export.py           # YOLO 标注导出
│   │   │   └── yolo_format.py      # YOLO 格式转换（共享）
│   │   └── main.py              # FastAPI 入口
│   ├── alembic/                 # 数据库迁移
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/          # React 组件
│       ├── pages/Home.tsx       # 主页面
│       ├── hooks/               # 自定义 hooks
│       │   ├── useDetection.ts       # 检测查询/变更
│       │   ├── useBatchDetection.ts  # 批量处理
│       │   └── useYoloValidation.ts  # YOLO 验证
│       ├── services/api.ts      # API 调用层 (axios)
│       ├── lib/                 # 常量 + 解析工具
│       └── types/               # TypeScript 类型
├── docker-compose.yml
├── start.sh / start.bat
└── README.md
```

## 功能

- **VLM 预标注**：上传图片，输入目标描述（如 `fire, smoke`），模型自动检测并绘制边界框
- **手动标注**：Canvas 画框模式，自由绘制边界框，类别标签快速填充
- **VLM + 手动 协同**：VLM 预标注打底 → 删错框 → 补漏框 → 导出训练
- **批量处理**：支持文件夹上传，串行批量标注
- **历史管理**：按标签筛选历史记录，重新检测
- **YOLO 训练**：标签筛选 + 缩略图预览，多系列可选（v5/v8/v11/v26），SSE 实时进度
- **模型验证**：用训练好的 YOLO 模型对图片进行推理验证，支持置信度/IoU 调节
- **YOLO 导出**：支持单张/批量导出 YOLO 格式标注文件

## API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/detect` | VLM 预标注 |
| GET | `/api/v1/detections` | 历史列表 |
| GET | `/api/v1/detections/{id}` | 检测详情 |
| GET | `/api/v1/detections/{id}/image` | 检测图片 |
| POST | `/api/v1/detections/{id}/boxes` | 手动添加标注框 |
| PUT | `/api/v1/detections/{id}/boxes/{box_id}` | 更新标注框坐标 |
| POST | `/api/v1/detections/{id}/boxes/{box_id}/delete` | 删除标注框 |
| POST | `/api/v1/detections/{id}/delete` | 删除检测记录 |
| GET | `/api/v1/detections/{id}/export` | 导出 YOLO 标注 |
| POST | `/api/v1/detections/export-batch` | 批量导出 YOLO 标注 |
| POST | `/api/v1/train/jobs` | 创建训练任务 |
| GET | `/api/v1/train/variants` | 可用 YOLO 系列列表 |
| GET | `/api/v1/train/jobs/{id}/progress/stream` | SSE 训练进度 |
| POST | `/api/v1/train/jobs/{id}/predict` | YOLO 模型推理 |
| POST | `/api/v1/train/jobs/{id}/delete` | 删除训练任务 |

## License

本项目代码 MIT。

LocateAnything-3B 模型遵循 [NVIDIA License](https://huggingface.co/nvidia/LocateAnything-3B/blob/main/LICENSE)（非商用）。
