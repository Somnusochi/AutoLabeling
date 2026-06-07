/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ImageUploader } from "./index";

// Mock i18next

describe("ImageUploader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.URL.createObjectURL = vi.fn(() => "blob:test");
    globalThis.URL.revokeObjectURL = vi.fn();

    // Mock Image object to immediately trigger onload since JSDOM doesn't support Object URLs
    Object.defineProperty(globalThis.Image.prototype, "src", {
      set(src) {
        if (src === "blob:test") {
          setTimeout(() => {
            if (typeof this.onload === "function") {
              this.onload();
            }
          }, 0);
        }
      },
      configurable: true,
    });

    // We also need to mock HTMLCanvasElement
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      drawImage: vi.fn(),
    })) as any;
    
    HTMLCanvasElement.prototype.toBlob = vi.fn(function(this: HTMLCanvasElement, callback: BlobCallback) {
      setTimeout(() => callback(new Blob(["test"], { type: "image/jpeg" })), 0);
    });
  });

  it("renders upload area initially", () => {
    render(<ImageUploader onFiles={vi.fn()} />);
    expect(screen.getByText("imageUploader.dragToUpload")).toBeInTheDocument();
  });

  it("handles file input change", async () => {
    const onFiles = vi.fn();
    render(<ImageUploader onFiles={onFiles} />);

    // Since jsdom Image is not fully implemented, compressImage will likely fail to load the image and fall back to returning the original file
    // which is perfectly fine for our component behavior test.
    const file = new File(["test image content"], "test.jpg", { type: "image/jpeg" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, "files", {
      value: [file],
    });
    fireEvent.change(input);

    await waitFor(() => {
      expect(onFiles).toHaveBeenCalled();
    });
    
    // Expect the original or processed file to be passed
    const passedFiles = onFiles.mock.calls[0][0];
    expect(passedFiles.length).toBe(1);
    expect(passedFiles[0].name).toBe("test.jpg");
  });

  it("handles clear action", async () => {
    const onFiles = vi.fn();
    const onClear = vi.fn();
    render(<ImageUploader onFiles={onFiles} onClear={onClear} />);

    // Mock that we already have a preview
    const file = new File(["test image content"], "test.jpg", { type: "image/jpeg" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, "files", {
      value: [file],
    });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/imageUploader\.clearAll/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/imageUploader\.clearAll/));

    expect(onFiles).toHaveBeenLastCalledWith([]);
    expect(onClear).toHaveBeenCalled();
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalled();
    expect(screen.queryByText(/imageUploader\.clearAll/)).not.toBeInTheDocument();
  });
});
