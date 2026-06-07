"""Regression snapshot tests for detection accuracy.

First run with --regenerate-snapshots to create baseline fixtures.
Subsequent runs compare against snapshots with tolerance for non-determinism.

Fixtures stored in tests/snapshots/ — committed to git for CI tracking.
"""

import glob
import json
import os

import pytest
import requests

BASE = "http://127.0.0.1:8000/api/v1"
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SNAPSHOT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "snapshots")

CAT_DIR = os.path.join(_PROJECT_ROOT, "test_images", "cat")
IMAGES = sorted(glob.glob(os.path.join(CAT_DIR, "*.jpg")))[:5] if os.path.isdir(CAT_DIR) else []


def _backend_reachable():
    try:
        requests.get(f"{BASE}/model/status", timeout=2)
        return True
    except Exception:
        return False


backend_required = pytest.mark.skipif(not _backend_reachable(), reason="Backend not running")

# Tolerance: box coordinates ±5px, confidence ±0.1
POS_TOLERANCE = 5
CONF_TOLERANCE = 0.15
BOX_COUNT_TOLERANCE = 0  # Must match exactly


def regenerate_snapshots():
    """Generate baseline snapshot fixtures. Run manually once."""
    os.makedirs(SNAPSHOT_DIR, exist_ok=True)
    for img_path in IMAGES:
        name = os.path.basename(img_path)
        with open(img_path, "rb") as f:
            resp = requests.post(
                f"{BASE}/detect",
                files={"file": (name, f, "image/jpeg")},
                data={"categories": '["cat"]'},
                timeout=120,
            )
        assert resp.status_code == 201, f"Failed: {resp.json()}"
        data = resp.json()["data"]
        # Strip variant fields before saving
        snapshot = {
            "imageName": name,
            "modelType": data["modelType"],
            "imageWidth": data["imageWidth"],
            "imageHeight": data["imageHeight"],
            "boxCount": len(data["boxes"]),
            "boxes": [
                {
                    "className": b["className"],
                    "x1": b["x1"],
                    "y1": b["y1"],
                    "x2": b["x2"],
                    "y2": b["y2"],
                    "confidence": b.get("confidence"),
                }
                for b in data["boxes"]
            ],
        }
        snapshot_path = os.path.join(SNAPSHOT_DIR, f"{os.path.splitext(name)[0]}.json")
        with open(snapshot_path, "w") as fp:
            json.dump(snapshot, fp, indent=2)
        print(f"  Saved {snapshot_path} ({snapshot['boxCount']} boxes)")


@backend_required
@pytest.mark.skipif(not IMAGES, reason="no test images")
class TestRegressionSnapshots:
    def test_snapshots_exist(self):
        """Ensure baseline snapshots have been generated."""
        if not os.path.isdir(SNAPSHOT_DIR):
            pytest.fail("No snapshot directory. Run: pytest tests/test_regression.py --regenerate")
        snapshots = os.listdir(SNAPSHOT_DIR)
        assert len(snapshots) >= 3, f"Need at least 3 snapshots, got {len(snapshots)}"

    @pytest.mark.parametrize("img_path", IMAGES)
    def test_detection_matches_snapshot(self, img_path):
        """Detection result matches baseline within tolerance."""
        name = os.path.basename(img_path)
        snapshot_path = os.path.join(SNAPSHOT_DIR, f"{os.path.splitext(name)[0]}.json")
        if not os.path.exists(snapshot_path):
            pytest.skip(f"No snapshot for {name}")

        with open(snapshot_path) as fp:
            expected = json.load(fp)

        with open(img_path, "rb") as f:
            resp = requests.post(
                f"{BASE}/detect",
                files={"file": (name, f, "image/jpeg")},
                data={"categories": '["cat"]'},
                timeout=120,
            )
        assert resp.status_code == 201, f"Detection failed: {resp.json()}"
        actual = resp.json()["data"]

        # Box count must match
        actual_boxes = actual["boxes"]
        assert len(actual_boxes) == expected["boxCount"], (
            f"Box count changed: expected {expected['boxCount']}, got {len(actual_boxes)}"
        )

        # Check each box against closest snapshot box
        for exp_box in expected["boxes"]:
            matched = False
            for act_box in actual_boxes:
                if act_box["className"] != exp_box["className"]:
                    continue
                if (
                    abs(act_box["x1"] - exp_box["x1"]) <= POS_TOLERANCE
                    and abs(act_box["y1"] - exp_box["y1"]) <= POS_TOLERANCE
                    and abs(act_box["x2"] - exp_box["x2"]) <= POS_TOLERANCE
                    and abs(act_box["y2"] - exp_box["y2"]) <= POS_TOLERANCE
                ):
                    # Confidence within tolerance
                    if exp_box["confidence"] is not None and act_box.get("confidence") is not None:
                        conf_diff = abs(act_box["confidence"] - exp_box["confidence"])
                        assert conf_diff <= CONF_TOLERANCE, (
                            f"Confidence drift: "
                            f"{exp_box['confidence']:.3f} → {act_box['confidence']:.3f}"
                        )
                    matched = True
                    break
            assert matched, (
                f"No matching box for class={exp_box['className']} "
                f"at ({exp_box['x1']},{exp_box['y1']},{exp_box['x2']},{exp_box['y2']})"
            )

    def test_model_type_consistent(self):
        """Model type should not change between runs."""
        for img_path in IMAGES[:1]:
            name = os.path.basename(img_path)
            snapshot_path = os.path.join(SNAPSHOT_DIR, f"{os.path.splitext(name)[0]}.json")
            if not os.path.exists(snapshot_path):
                pytest.skip(f"No snapshot for {name}")

            with open(snapshot_path) as fp:
                expected = json.load(fp)

            with open(img_path, "rb") as f:
                resp = requests.post(
                    f"{BASE}/detect",
                    files={"file": (name, f, "image/jpeg")},
                    data={"categories": '["cat"]'},
                    timeout=120,
                )
            actual = resp.json()["data"]
            assert actual["modelType"] == expected["modelType"], (
                f"modelType changed: {expected['modelType']} → {actual['modelType']}"
            )
