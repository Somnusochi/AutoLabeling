 
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DetectionCanvas } from "./index";

describe("DetectionCanvas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    imageUrl: "blob:test",
    boxes: [],
    imgWidth: 800,
    imgHeight: 600,
    mode: "view" as const,
    hiddenIndices: new Set<string>(),
    onModeChange: vi.fn(),
    onDrawBox: vi.fn(),
  };

  it("renders correctly in view mode", () => {
    render(<DetectionCanvas {...defaultProps} />);
    
    // Check mode radio buttons
    const viewRadio = screen.getByLabelText("common.view") as HTMLInputElement;
    const drawRadio = screen.getByLabelText("common.draw") as HTMLInputElement;
    
    expect(viewRadio.checked).toBe(true);
    expect(drawRadio.checked).toBe(false);
  });

  it("calls onModeChange when changing modes", () => {
    const onModeChange = vi.fn();
    render(<DetectionCanvas {...defaultProps} onModeChange={onModeChange} />);
    
    fireEvent.click(screen.getByLabelText("common.draw"));
    expect(onModeChange).toHaveBeenCalledWith("draw");
  });

  it("toggles bbox and mask visibility", () => {
    render(<DetectionCanvas {...defaultProps} />);
    
    const bboxCheckbox = screen.getByLabelText("common.bbox") as HTMLInputElement;
    const maskCheckbox = screen.getByLabelText("common.mask") as HTMLInputElement;
    
    expect(bboxCheckbox.checked).toBe(true);
    expect(maskCheckbox.checked).toBe(true);
    
    fireEvent.click(bboxCheckbox);
    expect(bboxCheckbox.checked).toBe(false);
    
    fireEvent.click(maskCheckbox);
    expect(maskCheckbox.checked).toBe(false);
  });
});
