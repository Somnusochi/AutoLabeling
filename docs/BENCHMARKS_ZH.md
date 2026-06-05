# 推理性能基准

## Windows 11 + RTX 3080 10GB (CUDA)

7 张猫图，各 3 轮，`max_new_tokens=512`，长边 800px。

| 模式 | 图片尺寸 | 平均耗时 | 稳定平均* |
|------|---------|---------|----------|
| VLM only | 大图 (800×640) | 1.0s | **1.0s** |
| VLM only | 缩略图 | 367ms | **367ms** |
| VLM + SAM2 | 大图 (800×640) | 3.4s | **3.4s** |
| VLM + SAM2 | 缩略图 | 475ms | **475ms** |

> *排除第 1 轮第 1 张（模型加载 ~22s）。

**显存**：VLM ~5.5GB 加载后；峰值 ~7.5GB+。10GB 可能触顶降速，推荐 12GB+。

## macOS Apple Silicon 24GB (MPS)

13 张猫图，各 3 轮，`max_new_tokens=512`，长边 1024px。

| 模式 | 冷启动 | 热启动 (R2) | 热启动 (R3) | 热启动平均 |
|------|--------|------------|------------|-----------|
| VLM + SAM2 | 13.8s | 4.9s | 4.9s | **4.9s/张** |
| VLM only | 3.7s | 4.3s | 4.3s | **4.3s/张** |

> 冷启动含 VLM + SAM2 模型加载（~14s）。SAM2 额外开销：+0.65s (15%)。Mask：13/13。

**内存**：6 轮全程 9.8–13GB 稳定，每次检测后 MPS 清理生效。

## 配置说明

- **长边上限**：根据 GPU 显存自动选择（<12GB → 800px，12–16GB → 1024px，≥16GB → 1333px；MPS → 1024px）
- **GPU 内存管理**：策略模式（`gpu_memory.py`）— CUDA `expandable_segments:True` / MPS `synchronize`+`empty_cache`+`gc`
- **SAM2 模型**：`facebook/sam2.1-hiera-base-plus`
