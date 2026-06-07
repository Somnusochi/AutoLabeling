/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from "@/utils/test-utils";
import {describe, it, expect} from "vitest";
import { VideoPanel } from "./index";

describe("VideoPanel", () => {
  it("renders without crashing", () => {
    // Note: Provide basic props if needed, or mock stores/hooks
    // This is a basic boilerplate test
    const { container } = render(<VideoPanel {...({} as any)} videoUrl="" setVideoUrl={() => {}} videoId={null} setVideoId={() => {}} />);
    expect(container).toBeTruthy();
  });
});
