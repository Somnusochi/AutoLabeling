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

完整目录树：**[docs/STRUCTURE_ZH.md](docs/STRUCTURE_ZH.md)**

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

完整 API 文档与请求/响应示例：**[docs/API_ZH.md](docs/API_ZH.md)**

## 跨平台

| 平台 | 推理后端 | 训练后端 |
|------|---------|---------|
| macOS (Apple Silicon) | MPS | MPS |
| Linux / Windows (NVIDIA) | CUDA | CUDA |

自动检测：CUDA → MPS。可通过 `DEVICE` 环境变量覆盖。**不支持 CPU。**

## 推理性能基准

完整基准测试：**[docs/BENCHMARKS_ZH.md](docs/BENCHMARKS_ZH.md)**

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

本项目代码：[MIT](LICENSE)。

第三方依赖协议：
- LocateAnything-3B 模型 — [NVIDIA License](https://huggingface.co/nvidia/LocateAnything-3B/blob/main/LICENSE)（非商用）
- Ultralytics YOLO — [AGPL-3.0](https://github.com/ultralytics/ultralytics/blob/main/LICENSE)（copyleft，训练/部署可能触发开源义务）
