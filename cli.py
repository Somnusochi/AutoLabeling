#!/usr/bin/env python3
"""VLM-AutoYOLO CLI — one command to setup and launch."""

import os
import shutil
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
VENV = BACKEND / ".venv"
PYTHON = VENV / "bin" / "python"
UVICORN = VENV / "bin" / "uvicorn"
ALEMBIC = VENV / "bin" / "alembic"

# ── Utilities ──────────────────────────────────────────

def green(s):
    return f"\033[92m{s}\033[0m"

def red(s):
    return f"\033[91m{s}\033[0m"

def cyan(s):
    return f"\033[96m{s}\033[0m"

def step(msg):
    print(f"  {cyan(msg)}")

def ok(msg):
    print(f"  {green('✓')} {msg}")

def fail(msg):
    print(f"  {red('✗')} {msg}")
    sys.exit(1)

def run(cmd, **kwargs):
    return subprocess.run(cmd, check=True, **kwargs)

def run_output(cmd, **kwargs):
    return subprocess.run(cmd, capture_output=True, text=True, **kwargs).stdout.strip()


# ── Prereq checks ──────────────────────────────────────

def check_python():
    step("Checking Python 3.12+...")
    v = sys.version_info
    if v.major == 3 and v.minor >= 12:
        ok(f"Python {v.major}.{v.minor}.{v.micro}")
        return
    fail(f"Python 3.12+ required, found {v.major}.{v.minor}")

def check_node():
    step("Checking Node.js 22+...")
    try:
        out = run_output(["node", "--version"])
        major = int(out.lstrip("v").split(".")[0])
        if major >= 22:
            ok(out)
            return
        fail(f"Node.js 22+ required, found {out}")
    except Exception:
        fail("Node.js not found. Install: brew install node / https://nodejs.org")

def check_ffmpeg():
    step("Checking ffmpeg...")
    if shutil.which("ffmpeg"):
        ok("found")
        return
    print("  ⚠ ffmpeg not found — video features will not work")
    print("    Install: brew install ffmpeg / apt install ffmpeg")

def check_postgres():
    step("Checking PostgreSQL...")
    env_file = BACKEND / ".env"
    if env_file.exists():
        content = env_file.read_text()
        if "DATABASE_URL" in content and "postgresql" in content:
            ok("configured in .env")
            return True
    ok("will use SQLite (zero-config)")
    return False


# ── Setup ──────────────────────────────────────────────

def setup_venv():
    step("Setting up Python virtual environment...")
    if VENV.exists():
        ok("already exists")
        return
    run([sys.executable, "-m", "venv", str(VENV)])
    run([str(VENV / "bin" / "pip"), "install", "--upgrade", "pip"], capture_output=True)
    ok("created")

def install_python_deps():
    step("Installing Python dependencies...")
    req = BACKEND / "requirements.txt"
    run([str(VENV / "bin" / "pip"), "install", "-r", str(req)], capture_output=True)
    ok("done")

def install_node_deps():
    step("Installing Node.js dependencies...")
    if (FRONTEND / "node_modules").exists():
        ok("already exists")
        return
    run(["pnpm", "install"], cwd=FRONTEND, capture_output=True)
    ok("done")

def check_db_config():
    env_file = BACKEND / ".env"
    env_example = BACKEND / ".env.example"
    if not env_file.exists() and env_example.exists():
        step("Creating .env from .env.example...")
        shutil.copy(env_example, env_file)
        ok("done")

def run_migrations():
    step("Running database migrations...")
    result = run_output(
        [str(ALEMBIC), "upgrade", "head"],
        cwd=BACKEND,
        env={**os.environ, "PYTHONPATH": str(BACKEND)},
    )
    if "Running" in result:
        ok("migrations applied")
    else:
        ok("up to date")


# ── Start ──────────────────────────────────────────────

def start_backend(port=8000):
    step(f"Starting backend on port {port}...")
    proc = subprocess.Popen(
        [str(UVICORN), "app.main:app", "--host", "0.0.0.0", "--port", str(port)],
        cwd=BACKEND,
        env={**os.environ, "PYTHONPATH": str(BACKEND)},
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    # Wait for backend to be ready
    import urllib.request
    import urllib.error
    for _ in range(30):
        time.sleep(0.5)
        try:
            urllib.request.urlopen(f"http://localhost:{port}/api/health", timeout=1)
            ok("backend ready")
            return proc
        except Exception:
            continue
    fail("backend failed to start")
    return proc

def start_frontend(port=5173, backend_port=8000):
    step(f"Starting frontend on port {port}...")
    proc = subprocess.Popen(
        ["pnpm", "dev", "--port", str(port)],
        cwd=FRONTEND,
        env={
            **os.environ,
            "VITE_BACKEND_PORT": str(backend_port),
        },
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    # Wait for frontend to be ready
    import urllib.request
    import urllib.error
    for _ in range(30):
        time.sleep(0.5)
        try:
            urllib.request.urlopen(f"http://localhost:{port}", timeout=1)
            ok("frontend ready")
            return proc
        except Exception:
            continue
    fail("frontend failed to start")
    return proc


# ── Main ────────────────────────────────────────────────

def cmd_setup():
    print(green("VLM-AutoYOLO Setup\n"))
    check_python()
    check_node()
    check_ffmpeg()
    check_postgres()
    setup_venv()
    install_python_deps()
    install_node_deps()
    check_db_config()
    run_migrations()
    print(f"\n{green('Setup complete!')} Run: {cyan('python cli.py start')}")

def cmd_start():
    print(green("VLM-AutoYOLO\n"))
    backend = start_backend()
    frontend = start_frontend()

    print(f"\n{'━' * 46}")
    print(f"  {green('VLM-AutoYOLO 已启动')}")
    print(f"  前端:   {cyan('http://localhost:5173')}")
    print(f"  后端:   {cyan('http://localhost:8000')}")
    print(f"  API 文档: {cyan('http://localhost:8000/docs')}")
    print(f"  {red('Ctrl+C')} 停止")
    print(f"{'━' * 46}\n")

    webbrowser.open("http://localhost:5173")

    try:
        backend.wait()
        frontend.wait()
    except KeyboardInterrupt:
        print(f"\n{green('已关闭')}")

def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "start"

    if cmd == "setup":
        cmd_setup()
    elif cmd == "start":
        cmd_start()
    elif cmd == "all":
        cmd_setup()
        print()
        cmd_start()
    else:
        print("Usage: python cli.py [setup|start|all]")
        print("  setup  — install dependencies and init database")
        print("  start  — launch backend + frontend (auto-setup if needed)")
        print("  all    — setup + start")
        sys.exit(1)

if __name__ == "__main__":
    main()
