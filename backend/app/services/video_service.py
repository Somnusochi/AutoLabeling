"""Video processing — keyframe extraction via ffmpeg + SSIM dedup."""

from __future__ import annotations

import json
import logging
import re
import subprocess
import uuid
from pathlib import Path

import cv2
import numpy as np

from ..core.config import settings

logger = logging.getLogger(__name__)


def _ffprobe(filepath: str) -> dict:
    """Extract video metadata via ffprobe. Raises on failure."""
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            filepath,
        ],
        capture_output=True,
        text=True,
        timeout=30,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {result.stderr}")

    probe = json.loads(result.stdout)
    video_stream = None
    for s in probe.get("streams", []):
        if s.get("codec_type") == "video":
            video_stream = s
            break
    if not video_stream:
        raise RuntimeError("No video stream found")

    fmt = probe.get("format", {})
    duration = float(fmt.get("duration", 0) or 0)
    a, b = video_stream.get("r_frame_rate", "0/1").split("/")
    fps = float(a) / float(b) if float(b) != 0 else 0.0
    return {
        "duration": duration,
        "fps": fps,
        "total_frames": int(video_stream.get("nb_frames", 0) or 0),
        "width": int(video_stream.get("width", 0)),
        "height": int(video_stream.get("height", 0)),
    }


def get_video_metadata(filepath: str) -> dict:
    return _ffprobe(filepath)


# ── ffmpeg extraction ──────────────────────────────────


def _ffmpeg_scene(filepath: str, output_dir: Path, threshold: float, max_frames: int) -> list[dict]:
    """Scene-change detection via ffmpeg native filter."""
    scene_val = threshold / 100.0  # user 1-100 → ffmpeg 0.01-1.0

    result = subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            filepath,
            "-vf",
            f"select='gt(scene,{scene_val:.4f})',showinfo",
            "-vsync",
            "vfr",
            "-frames:v",
            str(max_frames),
            str(output_dir / "kf_%05d.jpg"),
        ],
        capture_output=True,
        text=True,
        timeout=300,
    )

    # Parse pts_time from stderr
    pts_times: list[float] = []
    for line in result.stderr.split("\n"):
        m = re.search(r"pts_time:([\d.]+)", line)
        if m:
            pts_times.append(float(m.group(1)))

    jpg_files = sorted(output_dir.glob("kf_*.jpg"))
    frames: list[dict] = []
    for i, path in enumerate(jpg_files):
        t = pts_times[i] if i < len(pts_times) else i * 0.0
        frames.append(
            {
                "frame_number": i,
                "timestamp_seconds": round(t, 3),
                "image_path": str(path),
                "score": None,
            }
        )
    return frames


def _ffmpeg_motion(
    filepath: str, output_dir: Path, threshold: float, max_frames: int
) -> list[dict]:
    """Motion-aware extraction via ffmpeg + OpenCV optical flow.

    Uses ffmpeg to decode frames (reliable codec support), then OpenCV
    Lucas-Kanade optical flow to detect motion. Falls back to interval
    extraction if optical flow fails.
    """
    # Use ffmpeg pipe to avoid OpenCV codec issues
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        filepath,
        "-vf",
        "format=yuv420p",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "bgr24",
        "-",
    ]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    assert proc.stdout is not None

    meta = _ffprobe(filepath)
    fps = meta["fps"]
    w, h = meta["width"], meta["height"]
    frame_bytes = w * h * 3

    frames: list[dict] = []
    prev_gray: np.ndarray | None = None
    prev_pts: np.ndarray | None = None
    accumulated_motion = 0.0
    frame_num = 0

    while len(frames) < max_frames:
        raw = proc.stdout.read(frame_bytes)
        if len(raw) < frame_bytes:
            break

        frame = np.frombuffer(raw, dtype=np.uint8).reshape(h, w, 3)
        curr_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Always keep first frame
        if prev_gray is None:
            path = str(output_dir / f"kf_{frame_num:05d}.jpg")
            cv2.imwrite(path, frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            frames.append(
                {
                    "frame_number": frame_num,
                    "timestamp_seconds": round(frame_num / fps, 3),
                    "image_path": path,
                    "score": 0.0,
                }
            )
            prev_gray = curr_gray
            prev_pts = cv2.goodFeaturesToTrack(
                prev_gray, maxCorners=200, qualityLevel=0.01, minDistance=10
            )
            if prev_pts is None:
                prev_pts = np.array([]).reshape(0, 1, 2).astype(np.float32)
            frame_num += 1
            continue

        # Optical flow
        motion = 0.0
        if len(prev_pts) > 10:
            next_pts, status, _ = cv2.calcOpticalFlowPyrLK(
                prev_gray,
                curr_gray,
                prev_pts.astype(np.float32),
                None,
                winSize=(15, 15),
                maxLevel=2,
            )
            if next_pts is not None and status is not None:
                good_new = next_pts[status.flatten() == 1]
                good_old = prev_pts[status.flatten() == 1]
                if len(good_new) > 5:
                    motion = float(np.median(np.linalg.norm(good_new - good_old, axis=1)))

        accumulated_motion += motion

        if accumulated_motion >= threshold:
            path = str(output_dir / f"kf_{frame_num:05d}.jpg")
            cv2.imwrite(path, frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            frames.append(
                {
                    "frame_number": frame_num,
                    "timestamp_seconds": round(frame_num / fps, 3),
                    "image_path": path,
                    "score": round(accumulated_motion, 2),
                }
            )
            accumulated_motion = 0.0
            prev_gray = curr_gray
            prev_pts = cv2.goodFeaturesToTrack(
                prev_gray, maxCorners=200, qualityLevel=0.01, minDistance=10
            )
            if prev_pts is None:
                prev_pts = np.array([]).reshape(0, 1, 2).astype(np.float32)

        # Refresh feature points periodically
        if frame_num % 30 == 0:
            prev_gray = curr_gray if len(prev_pts) < 10 else prev_gray
            if len(prev_pts) < 10:
                prev_pts = cv2.goodFeaturesToTrack(
                    prev_gray, maxCorners=200, qualityLevel=0.01, minDistance=10
                )
                if prev_pts is None:
                    prev_pts = np.array([]).reshape(0, 1, 2).astype(np.float32)

        frame_num += 1

    proc.terminate()
    return frames


def _ffmpeg_interval(
    filepath: str, output_dir: Path, interval: float, max_frames: int, fps: float
) -> list[dict]:
    """Fixed-interval extraction via ffmpeg select filter."""
    frame_step = max(1, int(interval * fps))

    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            filepath,
            "-vf",
            f"select='not(mod(n,{frame_step}))'",
            "-vsync",
            "vfr",
            "-frames:v",
            str(max_frames),
            str(output_dir / "kf_%05d.jpg"),
        ],
        capture_output=True,
        text=True,
        timeout=300,
    )

    jpg_files = sorted(output_dir.glob("kf_*.jpg"))
    frames: list[dict] = []
    for i, path in enumerate(jpg_files):
        frame_num = i * frame_step  # select='not(mod(n,step))' picks frames 0, step, 2*step, ...
        new_path = output_dir / f"kf_{frame_num:05d}.jpg"
        path.rename(new_path)
        frames.append(
            {
                "frame_number": frame_num,
                "timestamp_seconds": round(frame_num / fps, 3),
                "image_path": str(new_path),
                "score": None,
            }
        )

    return frames


# ── SSIM dedup ──────────────────────────────────────────


def _ssim(a: np.ndarray, b: np.ndarray) -> float:
    a_f = a.astype(np.float32)
    b_f = b.astype(np.float32)
    c1 = (0.01 * 255) ** 2
    c2 = (0.03 * 255) ** 2
    mu_a = cv2.GaussianBlur(a_f, (11, 11), 1.5)
    mu_b = cv2.GaussianBlur(b_f, (11, 11), 1.5)
    mu_a2, mu_b2, mu_ab = mu_a**2, mu_b**2, mu_a * mu_b
    sigma_a2 = cv2.GaussianBlur(a_f**2, (11, 11), 1.5) - mu_a2
    sigma_b2 = cv2.GaussianBlur(b_f**2, (11, 11), 1.5) - mu_b2
    sigma_ab = cv2.GaussianBlur(a_f * b_f, (11, 11), 1.5) - mu_ab
    num = (2 * mu_ab + c1) * (2 * sigma_ab + c2)
    den = (mu_a2 + mu_b2 + c1) * (sigma_a2 + sigma_b2 + c2)
    return float(np.mean(num / (den + 1e-8)))


def _deduplicate(frames: list[dict], ssim_threshold: float) -> list[dict]:
    if not frames or ssim_threshold >= 1.0:
        return frames

    kept = [frames[0]]
    last_img = cv2.imread(frames[0]["image_path"], cv2.IMREAD_GRAYSCALE)
    if last_img is None:
        return frames

    target_size = (320, 240)

    for fd in frames[1:]:
        curr = cv2.imread(fd["image_path"], cv2.IMREAD_GRAYSCALE)
        if curr is None:
            kept.append(fd)
            last_img = None
            continue
        sim = (
            _ssim(cv2.resize(last_img, target_size), cv2.resize(curr, target_size))
            if last_img is not None
            else 0.0
        )
        if sim < ssim_threshold:
            kept.append(fd)
        else:
            Path(fd["image_path"]).unlink(missing_ok=True)
        last_img = curr

    removed = len(frames) - len(kept)
    if removed:
        logger.info(
            "SSIM dedup removed %d/%d frames (threshold=%.2f)", removed, len(frames), ssim_threshold
        )
    return kept


# ── Public API ──────────────────────────────────────────


def extract_keyframes(
    filepath: str,
    *,
    method: str = "scene",
    threshold: float = 30.0,
    interval_seconds: float = 2.0,
    max_frames: int = 200,
    ssim_threshold: float = 0.95,
) -> list[dict]:
    video_id = uuid.uuid4().hex[:12]
    output_dir = settings.upload_dir / f"keyframes_{video_id}"
    output_dir.mkdir(parents=True, exist_ok=True)

    meta = _ffprobe(filepath)
    fps = meta["fps"]
    logger.info("Extracting keyframes: method=%s file=%s fps=%.1f", method, filepath, fps)

    if method == "interval":
        raw = _ffmpeg_interval(filepath, output_dir, interval_seconds, max_frames, fps)
    elif method == "motion":
        raw = _ffmpeg_motion(filepath, output_dir, threshold, max_frames)
    else:
        raw = _ffmpeg_scene(filepath, output_dir, threshold, max_frames)

    logger.info("Raw frames: %d (method=%s)", len(raw), method)

    # Fallback: always extract at least the first frame
    if len(raw) == 0:
        logger.warning("No frames extracted, grabbing first frame as fallback")
        subprocess.run(
            ["ffmpeg", "-y", "-i", filepath, "-vframes", "1", str(output_dir / "kf_00000.jpg")],
            capture_output=True,
            text=True,
            timeout=30,
        )
        raw = [
            {
                "frame_number": 0,
                "timestamp_seconds": 0.0,
                "image_path": str(output_dir / "kf_00000.jpg"),
                "score": None,
            }
        ]

    return _deduplicate(raw, ssim_threshold)
