import os
import glob
import time
import requests
import subprocess
from PIL import Image

CAT_DIR = "/root/autodl-tmp/cat"
THUMB_DIR = "/root/autodl-tmp/cat_thumb"
URL = "http://127.0.0.1:6006/api/v1/detect"
ROUNDS = 4

def get_vram():
    try:
        # Try nvidia-smi first (Linux/Windows with CUDA)
        out = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"],
            text=True
        )
        return int(out.strip().split('\n')[0])
    except Exception:
        pass
        
    try:
        # Fallback for macOS (Apple Silicon MPS uses unified memory tied to the process)
        # Find the backend process listening on port 6006
        pid_out = subprocess.check_output(["lsof", "-t", "-i:6006"], text=True).strip()
        if pid_out:
            pid = pid_out.split('\n')[0]
            # Get the RSS (Resident Set Size) in KB and convert to MB
            rss_out = subprocess.check_output(["ps", "-o", "rss=", "-p", pid], text=True).strip()
            return int(rss_out) // 1024
    except Exception:
        pass
        
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
    print("Thumbnails ready in", THUMB_DIR)

def wait_for_server():
    print("Waiting for server to fully initialize...")
    while True:
        try:
            resp = requests.get("http://127.0.0.1:6006/docs", timeout=5)
            if resp.status_code == 200:
                print("Server is up!")
                break
        except Exception:
            pass
        time.sleep(2)

def run_suite(mode_name, img_dir, use_sam2):
    print(f"\n=====================================")
    print(f"Running Suite: {mode_name}")
    print(f"Directory: {img_dir} | SAM2: {use_sam2}")
    print(f"=====================================")
    
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
                if vram > peak_vram: peak_vram = vram
                
                # If first image of first round
                if r == 1 and i == 0:
                    cold_start_time = elapsed
                    print(f"  [Cold Start - Img 1] {elapsed:.2f}s (VRAM: {vram}MB)")
                else:
                    print(f"  [R{r} - Img {i+1}] {elapsed:.2f}s")
                    
        avg = sum(round_times) / len(round_times)
        round_avgs.append(avg)
        print(f"--- Round {r} Average: {avg:.2f}s ---")
        
    stable_avg = sum(round_avgs[1:]) / len(round_avgs[1:]) if len(round_avgs) > 1 else round_avgs[0]
    
    print("\n--- Summary ---")
    print(f"Cold Start (First Image): {cold_start_time:.2f}s")
    for r in range(1, ROUNDS + 1):
        print(f"R{r} Avg: {round_avgs[r-1]:.2f}s")
    print(f"Stable Avg (R2-R{ROUNDS}): {stable_avg:.2f}s")
    print(f"Peak VRAM: {peak_vram} MB")
    print("-------------------------------------\n")

if __name__ == "__main__":
    create_thumbnails()
    wait_for_server()
    # 1. VLM only (Thumbnails)
    run_suite("VLM only (Thumbnail)", THUMB_DIR, use_sam2=False)
    # 2. VLM only (Large)
    run_suite("VLM only (Large)", CAT_DIR, use_sam2=False)
    # 3. VLM + SAM2 (Thumbnails)
    run_suite("VLM + SAM2 (Thumbnail)", THUMB_DIR, use_sam2=True)
    # 4. VLM + SAM2 (Large)
    run_suite("VLM + SAM2 (Large)", CAT_DIR, use_sam2=True)
