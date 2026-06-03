from __future__ import annotations

import cv2
import numpy as np

from app.services.video_service import _deduplicate, _ssim


def test_ssim_same():
    img = np.ones((100, 100), dtype=np.uint8) * 128
    score = _ssim(img, img)
    assert abs(score - 1.0) < 1e-4


def test_ssim_different():
    img_a = np.zeros((100, 100), dtype=np.uint8)
    img_b = np.ones((100, 100), dtype=np.uint8) * 255
    score = _ssim(img_a, img_b)
    assert score < 0.1


def test_deduplicate(tmp_path):
    img_a = np.ones((100, 100), dtype=np.uint8) * 128
    img_b = np.ones((100, 100), dtype=np.uint8) * 128  # same as a
    img_c = np.zeros((100, 100), dtype=np.uint8)  # different from a

    path_a = tmp_path / "a.jpg"
    path_b = tmp_path / "b.jpg"
    path_c = tmp_path / "c.jpg"

    cv2.imwrite(str(path_a), img_a)
    cv2.imwrite(str(path_b), img_b)
    cv2.imwrite(str(path_c), img_c)

    frames = [
        {"image_path": str(path_a), "frame_number": 0, "timestamp_seconds": 0.0},
        {"image_path": str(path_b), "frame_number": 1, "timestamp_seconds": 1.0},
        {"image_path": str(path_c), "frame_number": 2, "timestamp_seconds": 2.0},
    ]

    # Deduplicate with threshold 0.95 (a and b should merge, c stays)
    kept = _deduplicate(frames, 0.95)
    assert len(kept) == 2
    assert kept[0]["image_path"] == str(path_a)
    assert kept[1]["image_path"] == str(path_c)
