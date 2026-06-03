# VLM-AutoYOLO 用户指南

欢迎使用 VLM-AutoYOLO！本指南将帮助你快速上手并充分利用这个端到端的目标检测自动标注与训练平台。

## 指南目录

- [快速开始](./getting-started.md) - 从安装到第一个检测结果的完整流程
- [标注最佳实践](./annotation-tips.md) - VLM 预标注和人工修正的技巧与经验
- [训练参数调优](./training-guide.md) - YOLO 训练参数选择与数据集准备指南

## 系统要求

| 平台 | 最低配置 |
|------|---------|
| **GPU** | NVIDIA GPU 8GB+ 显存 / Apple Silicon (MPS) |
| **内存** | 16GB RAM（推荐 32GB） |
| **存储** | 50GB 可用空间 |
| **操作系统** | macOS 12+ / Ubuntu 20.04+ / Windows 10+ |
| **Python** | 3.12+ |
| **Node.js** | 22+ |

## 核心工作流

```
上传图片/视频 → VLM 自动标注 → 人工修正 → 导出数据集 → 训练 YOLO → 验证模型
```

1. **VLM 预标注**：使用 LocateAnything-3B 视觉语言模型自动生成边界框
2. **人工修正**：在 Canvas 画布上调整、删除、添加标注框
3. **数据导出**：导出 YOLO 格式标注文件（支持单图和批量）
4. **模型训练**：一键训练 YOLOv5/v8/v11/v26，实时查看训练进度
5. **模型验证**：在测试图片/视频上验证训练效果

## 快速导航

- 第一次使用？→ [快速开始](./getting-started.md)
- 想提高标注质量？→ [标注最佳实践](./annotation-tips.md)
- 训练效果不理想？→ [训练参数调优](./training-guide.md)

## 获取帮助

- 查看 [API 文档](http://localhost:8000/docs) 了解后端接口详情
- 遇到问题？请在 [GitHub Issues](https://github.com/Somnusochi/VLM-AutoYOLO/issues) 提交反馈
