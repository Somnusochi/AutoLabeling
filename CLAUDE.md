# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 工作流规则

- **不要主动提交**。只有用户明确说"提交"/"commit"时才提交
- **不要主动推送**。只有用户明确说"推送"/"push"时才推送
- **不要主动打 tag**。只有用户明确说"打 tag"/"add tag"时才打 tag

## 命令

### 启动开发环境

```bash
./start.sh                    # 同时启动前后端
cd backend && PYTHONPATH=. .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
cd frontend && pnpm dev       # Vite dev server → localhost:5173
```

### 前端 (`frontend/`)

```bash
pnpm dev                       # 开发服务器（HMR）
pnpm run lint                  # ESLint
npx tsc --noEmit --pretty      # TypeScript 类型检查
pnpm run build                 # 生产构建 = tsc + vite build
```

### 后端 (`backend/`)

```bash
PYTHONPATH=. .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

ruff check app/                # Lint，必须零错误
ruff format --check app/       # 格式检查，必须无待格式化文件
ruff format app/               # 自动格式化
ruff check app/ --fix          # 自动修可修的 lint 问题

PYTHONPATH=. pytest tests/ -v              # 运行全部测试
PYTHONPATH=. pytest tests/path.py -v       # 运行单个测试文件
PYTHONPATH=. pytest tests/ -k "test_name"  # 运行匹配名称的测试

PYTHONPATH=. alembic upgrade head          # 运行数据库迁移
PYTHONPATH=. alembic stamp <revision>      # 标记迁移版本（跳过冲突迁移）
```

### 提交前检查

| 改动范围 | 必须执行 |
|---------|---------|
| `frontend/` | `npx tsc --noEmit --pretty` + `pnpm run lint` |
| `backend/` | `ruff check app/` + `ruff format --check app/` |

### Tag 前额外检查

除了上述检查，还必须：

```bash
cd frontend && pnpm run build              # 完整前端构建
cd backend && PYTHONPATH=. pytest tests/ -v # 全部测试通过
```

以上通过后，同步更新 `CHANGELOG.md` 和必要时更新 README 文档。

## 架构

### 数据流

```
上传图片 → VLM 检测(LocateAnything-3B) → bbox
         → [可选] SAM2 分割 → mask polygon
         → DetectionBox 存入 PostgreSQL/SQLite
         → 前端 Canvas 渲染（bbox + mask 可独立开关）
         → 导出（5 种格式）→ YOLO 训练（检测/分割）
```

### 关键概念

- **VLM**：`locate_anything.py` — LocateAnything-3B 模型，惰性加载，支持 CUDA/MPS，CPU 禁止
- **SAM2**：`sam2_service.py` — SAM 2.1 模型，bbox → mask polygon，惰性加载，闲置卸载
- **GPU 内存**：`gpu_memory.py` — 策略模式，CUDA (`expandable_segments`) / MPS (`synchronize`+`empty_cache`)
- **检测框**：`DetectionBox` 模型含 `mask_polygon` JSON 列，`confidence` 预留
- **导出**：`export.py` 分发到 `yolo_format.py`/`coco_format.py`/`voc_format.py`/`createml_format.py`
- **训练**：`trainer.py` — `_build_dataset()` 按 task_type 选择 bbox 或 seg 标签格式
- **数据库**：SQLAlchemy 2.0，支持 PostgreSQL（生产）和 SQLite（本地免配置）
- **API 响应**：`APIResponse` 包装 `{data, error, total, page, pageSize}`，驼峰命名
- **前端状态**：`useHomeState.ts` 集中管理检测/训练/验证全流程状态
- **i18n**：`i18next` 三语（zh/en/ja），浏览器语言自动检测

### 目录约定

- `backend/app/api/routes/` — FastAPI 路由，每个文件一个 `APIRouter`
- `backend/app/services/` — 业务逻辑，不直接触数据库 Session
- `backend/app/repositories/` — 数据访问层，封装所有 SQLAlchemy 查询
- `backend/app/schemas/` — Pydantic 模型，`from_attributes = True`
- `backend/app/core/` — 配置、数据库引擎、中间件、异常
- `frontend/src/components/` — React 组件，按功能拆分，`training/` 子目录
- `frontend/src/hooks/` — 自定义 hooks，每个功能一个文件
- `frontend/src/i18n/locales/` — 翻译 JSON，key 结构与 en.json 对齐
