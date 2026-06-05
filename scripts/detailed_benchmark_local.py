"""
Local benchmark script adapted for Windows environment.
Targets the local backend on port 8000 with test_images/cat/.
"""
import os
import glob
import time
import tempfile
import requests
import subprocess
from PIL import Image

CAT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "test_images", "cat")
THUMB_DIR = os.path.join(tempfile.gettempdir(), "vlm_autoyolo_bench_thumb")
URL = "http://127.0.0.1:8000/api/v1/detect"
ROUNDS = 4


def get_vram():
    """Get GPU VRAM used in MB via nvidia-smi."""
    try:
        out = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"],
            text=True,
        )
        return int(out.strip().split("\n")[0])
    except Exception:
        return -1


def create_thumbnails():
    os.makedirs(THUMB_DIR, exist_ok=True)
    images = glob.glob(os.path.join(CAT_DIR, "*.jpg"))
    for img_path in images:
        basename = os.path.basename(img_path)
        thumb_path = os.path.join(THUMB_DIR, basename)
        if not os.path.exists(thumb_path):
            with Image.open(img_path) as img:
                img.thumbnail((256, 256))
                img.save(thumb_path)
    print(f"Thumbnails ready in {THUMB_DIR} ({len(images)} images)")


def wait_for_server():
    print("Waiting for server to fully initialize...")
    while True:
        try:
            resp = requests.get("http://127.0.0.1:8000/docs", timeout=5)
            if resp.status_code == 200:
                print("Server is up!")
                break
        except Exception:
            pass
        time.sleep(2)


def run_suite(mode_name, img_dir, use_sam2):
    print(f"\n{'='*45}")
    print(f"Running Suite: {mode_name}")
    print(f"Directory: {img_dir} | SAM2: {use_sam2}")
    print(f"{'='*45}")

    images = glob.glob(os.path.join(img_dir, "*.jpg"))
    if not images:
        print("No images found!")
        return

    peak_vram = 0
    cold_start_time = 0
    round_avgs = []

    for r in range(1, ROUNDS + 1):
        round_times = []
        for i, img_path in enumerate(images):
            with open(img_path, "rb") as f:
                files = {"file": (os.path.basename(img_path), f, "image/jpeg")}
                data = {"categories": '["cat"]', "use_sam2": str(use_sam2).lower()}

                t0 = time.time()
                try:
                    resp = requests.post(URL, files=files, data=data)
                    resp.raise_for_status()
                except Exception as e:
                    print(f"Error: {e}")
                    continue
                t1 = time.time()

                elapsed = t1 - t0
                round_times.append(elapsed)

                vram = get_vram()
                if vram > peak_vram:
                    peak_vram = vram

                # First image of first round = cold start
                if r == 1 and i == 0:
                    cold_start_time = elapsed
                    print(f"  [Cold Start - Img 1] {elapsed:.2f}s (VRAM: {vram}MB)")
                else:
                    print(f"  [R{r} - Img {i+1}] {elapsed:.2f}s (VRAM: {vram}MB)")

        if round_times:
            avg = sum(round_times) / len(round_times)
            round_avgs.append(avg)
            print(f"--- Round {r} Average: {avg:.2f}s ---")
        else:
            print(f"--- Round {r}: ALL FAILED ---")

    if not round_avgs:
        print("\n--- Suite FAILED: no successful rounds ---\n")
        return

    stable_avg = sum(round_avgs[1:]) / len(round_avgs[1:]) if len(round_avgs) > 1 else round_avgs[0]

    round_details = " / ".join(f"{x:.2f}s" for x in round_avgs)

    print("\n--- Summary ---")
    print(f"Cold Start (First Image): {cold_start_time:.2f}s")
    for idx, val in enumerate(round_avgs, 1):
        print(f"R{idx} Avg: {val:.2f}s")
    print(f"Stable Avg (R2-R{ROUNDS}): {stable_avg:.2f}s")
    print(f"Peak VRAM: {peak_vram} MB")
    print(f"Round Details: {round_details}")
    print("-------------------------------------\n")

    return {
        "mode": mode_name,
        "img_dir": img_dir,
        "use_sam2": use_sam2,
        "cold_start": cold_start_time,
        "round_avgs": round_avgs,
        "stable_avg": stable_avg,
        "peak_vram": peak_vram,
    }


if __name__ == "__main__":
    results = []
    create_thumbnails()
    wait_for_server()

    # 1. VLM only (Thumbnails)
    results.append(run_suite("VLM only (Thumbnail)", THUMB_DIR, use_sam2=False))

    # 2. VLM only (Large)
    results.append(run_suite("VLM only (Large)", CAT_DIR, use_sam2=False))

    # 3. VLM + SAM2 (Thumbnails)
    results.append(run_suite("VLM + SAM2 (Thumbnail)", THUMB_DIR, use_sam2=True))

    # 4. VLM + SAM2 (Large)
    results.append(run_suite("VLM + SAM2 (Large)", CAT_DIR, use_sam2=True))

    # Print final summary
    print("\n" + "=" * 60)
    print("FINAL BENCHMARK SUMMARY")
    print("=" * 60)
    for r in results:
        if r:
            print(f"\n{r['mode']}:")
            print(f"  Cold Start: {r['cold_start']:.2f}s")
            print(f"  Rounds: {' / '.join(f'{x:.2f}s' for x in r['round_avgs'])}")
            print(f"  Stable Avg: {r['stable_avg']:.2f}s")
            print(f"  Peak VRAM: {r['peak_vram']} MB")
    print("\n" + "=" * 60)
