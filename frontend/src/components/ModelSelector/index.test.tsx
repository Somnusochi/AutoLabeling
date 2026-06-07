 
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ModelSelector } from "./index";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: [
      { id: "1", status: "completed", modelVariant: "yolov8n" },
      { id: "2", status: "failed", modelVariant: "yolov8s" },
    ],
  }),
}));

describe("ModelSelector", () => {
  const defaultProps = {
    selectedJobId: null,
    onSelectJob: vi.fn(),
    modelSource: "trained" as const,
    onSourceChange: vi.fn(),
    externalFile: null,
    onExternalFile: vi.fn(),
  };

  it("renders trained model option initially", () => {
    render(<ModelSelector {...defaultProps} />);
    
    // Ant Design Radio inputs
    const trainedRadio = screen.getByLabelText("validationSettings.trainedModel");
    const uploadRadio = screen.getByLabelText("validationSettings.uploadModel");
    
    expect(trainedRadio).toBeInTheDocument();
    expect(uploadRadio).toBeInTheDocument();
  });

  it("switches to upload mode", () => {
    const onSourceChange = vi.fn();
    render(<ModelSelector {...defaultProps} onSourceChange={onSourceChange} />);
    
    fireEvent.click(screen.getByLabelText("validationSettings.uploadModel"));
    expect(onSourceChange).toHaveBeenCalledWith("upload");
  });

  it("renders upload UI when modelSource is upload", () => {
    render(<ModelSelector {...defaultProps} modelSource="upload" />);
    expect(screen.getByText("validationSettings.selectPtModel")).toBeInTheDocument();
  });
});
