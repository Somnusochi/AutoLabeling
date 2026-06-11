#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"

# ── Port selection ──────────────────────────────────
find_free_port() {
    local start=$1
    local port=$start
    while lsof -i ":$port" -sTCP:LISTEN -t >/dev/null 2>&1; do
        port=$((port + 1))
    done
    echo $port
}

BACKEND_PORT=${BACKEND_PORT:-$(find_free_port 8000)}
FRONTEND_PORT=${FRONTEND_PORT:-$(find_free_port 5173)}

# Allow override via env:  BACKEND_PORT=9000 FRONTEND_PORT=3000 ./start.sh
if [ -n "${1:-}" ]; then BACKEND_PORT=$1; fi
if [ -n "${2:-}" ]; then FRONTEND_PORT=$2; fi

# ── Backend ──────────────────────────────────────────
echo "🔧 启动后端 (http://localhost:$BACKEND_PORT) ..."
cd "$BACKEND_DIR"
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port $BACKEND_PORT --reload &
BACKEND_PID=$!

# ── Frontend ─────────────────────────────────────────
echo "🔧 启动前端 (http://localhost:$FRONTEND_PORT) ..."
cd "$FRONTEND_DIR"
VITE_BACKEND_PORT=$BACKEND_PORT npm run dev -- --port $FRONTEND_PORT &
FRONTEND_PID=$!

# ── Cleanup on exit ──────────────────────────────────
cleanup() {
    echo ""
    echo "🛑 正在关闭..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    wait
    echo "✅ 已关闭"
}
trap cleanup EXIT INT TERM

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 VLM-AutoYOLO 已启动"
echo "  前端: http://localhost:$FRONTEND_PORT"
echo "  后端: http://localhost:$BACKEND_PORT"
echo "  API文档: http://localhost:$BACKEND_PORT/docs"
echo "  Ctrl+C 停止"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  💡 提示: VLM 和 SAM 模型采用【惰性加载】策略。"
echo "     在网页端首次执行检测前，它们会显示为“未加载”状态。"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

wait
