import os
import glob
import time
import requests
import subprocess
import statistics

# Set directories and URL
CAT_DIR = "/root/autodl-tmp/cat"
URL = "http://127.0.0.1:6006/api/v1/detect"
ROUNDS = 6

def get_vram():
    """Get total VRAM used in MB"""
    try:
        out = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"],
            text=True
        )
        return int(out.strip().split('\n')[0])
    except Exception:
        return -1

def wait_for_server():
    print("Waiting for server to fully initialize on port 6006...")
    while True:
        try:
            # The docs endpoint should return 200 immediately
            resp = requests.get("http://127.0.0.1:6006/docs", timeout=5)
            if resp.status_code == 200:
                print("Server is up and accepting connections!")
                break
        except requests.exceptions.RequestException:
            pass
        time.sleep(5)

def run_benchmark(use_sam2=False):
    mode = "VLM + SAM2" if use_sam2 else "VLM only"
    print(f"\n--- Starting Benchmark: {mode} ---")
    
    # Get all jpg images
    images = glob.glob(os.path.join(CAT_DIR, "*.jpg"))
    if not images:
        print("No images found in", CAT_DIR)
        return

    # To track peak vram
    peak_vram = 0

    all_round_times = []

    for r in range(1, ROUNDS + 1):
        print(f"\nRound {r}/{ROUNDS}:")
        round_times = []
        for img_path in images:
            with open(img_path, "rb") as f:
                files = {"file": (os.path.basename(img_path), f, "image/jpeg")}
                data = {"categories": '["cat"]', "use_sam2": str(use_sam2).lower()}
                
                t0 = time.time()
                try:
                    # No timeout, allow model loading to block
                    resp = requests.post(URL, files=files, data=data)
                    resp.raise_for_status()
                except Exception as e:
                    print(f"Error processing {os.path.basename(img_path)}: {e}")
                    continue
                t1 = time.time()
                
                elapsed = t1 - t0
                round_times.append(elapsed)
                
                # Check VRAM
                vram = get_vram()
                if vram > peak_vram:
                    peak_vram = vram
                
                print(f"  {os.path.basename(img_path)}: {elapsed:.3f}s (VRAM: {vram} MB)")
                
        # Round avg
        if round_times:
            avg_round = sum(round_times) / len(round_times)
            all_round_times.append(avg_round)
            print(f"  -> Round {r} Average: {avg_round:.3f}s")
            
    # Calculate stable average (excluding Round 1)
    if len(all_round_times) > 1:
        stable_avg = sum(all_round_times[1:]) / len(all_round_times[1:])
    else:
        stable_avg = all_round_times[0] if all_round_times else 0
        
    print(f"\n[{mode}] Peak VRAM Used: {peak_vram} MB")
    print(f"[{mode}] R1 (Cold) Avg: {all_round_times[0] if all_round_times else 0:.3f}s")
    print(f"[{mode}] Stable Avg (R2-R6): {stable_avg:.3f}s")

if __name__ == "__main__":
    wait_for_server()
    run_benchmark(use_sam2=False)
    run_benchmark(use_sam2=True)
