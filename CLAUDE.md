# CLAUDE.md — VLM-AutoYOLO

## 提交与推送

- **不要主动提交**。只有用户明确说"提交"/"commit"时才提交
- **不要主动推送**。只有用户明确说"推送"/"push"时才推送
- **不要主动打 tag**。只有用户明确说"打 tag"/"add tag"时才打 tag

## 提交前检查

每次提交前，根据改动范围执行对应检查：

### 前端改动（`frontend/`）

```bash
cd frontend
npx tsc --noEmit --pretty   # 类型检查，必须零错误
pnpm run lint               # ESLint，必须零错误
```

### 后端改动（`backend/`）

```bash
cd backend
ruff check app/             # 必须零错误
ruff format --check app/    # 必须无待格式化文件
```

## Tag 前额外检查

打 tag 前除了上述检查，还必须：

```bash
# 前端 — 完整构建
cd frontend && pnpm run build   # 必须成功

# 后端 — 完整测试
cd backend && PYTHONPATH=. pytest tests/ -v   # 必须全部通过
```

以上全部通过后才能打 tag。
