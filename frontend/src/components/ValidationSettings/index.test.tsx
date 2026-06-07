/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from "@/utils/test-utils";
import {describe, it, expect} from "vitest";
import { ValidationSettings } from "./index";

describe("ValidationSettings", () => {
  it("renders without crashing", () => {
    // Note: Provide basic props if needed, or mock stores/hooks
    // This is a basic boilerplate test
    const { container } = render(<ValidationSettings {...({} as any)} validateConf={0.5} validateIou={0.5} />);
    expect(container).toBeTruthy();
  });
});
