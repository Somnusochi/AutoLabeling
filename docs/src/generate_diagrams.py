import os
import subprocess
import sys

def main():
    # Target files
    src_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(src_dir)  # docs folder is one level up
    output_dir = project_root
    
    templates = {
        "workflow": os.path.join(src_dir, "workflow_template.html"),
        "architecture": os.path.join(src_dir, "architecture_template.html"),
        "scenarios": os.path.join(src_dir, "scenarios_template.html")
    }

    # Locate Google Chrome on macOS
    chrome_path = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    if not os.path.exists(chrome_path):
        print(f"Error: Google Chrome was not found at '{chrome_path}'")
        print("Please make sure Google Chrome is installed in your Applications folder.")
        sys.exit(1)

    print("Found Google Chrome. Starting image generation...")

    for name, path in templates.items():
        if not os.path.exists(path):
            print(f"Error: Template not found at '{path}'")
            continue

        output_path = os.path.join(output_dir, f"{name}.png")
        file_url = f"file://{path}"

        print(f"Generating docs/{name}.png from {path}...")

        # Run headless chrome to take a high-res screenshot
        cmd = [
            chrome_path,
            "--headless=new",
            "--disable-gpu",
            f"--screenshot={output_path}",
            "--window-size=1200,750",
            "--force-device-scale-factor=2",
            "--hide-scrollbars",
            file_url
        ]

        try:
            result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
            if os.path.exists(output_path):
                print(f" Successfully generated: {output_path}")
            else:
                print(f" Failed to generate image file for {name}.")
                if result.stderr:
                    print(f"Error details: {result.stderr}")
        except subprocess.CalledProcessError as e:
            print(f"Error running Chrome for {name}: {e}")
            print(f"stdout: {e.stdout}")
            print(f"stderr: {e.stderr}")

    print("\nAll done! Check your docs/ directory for the output PNG images.")

if __name__ == "__main__":
    main()
