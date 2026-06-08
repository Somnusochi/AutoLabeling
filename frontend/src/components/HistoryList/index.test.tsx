import { render } from "@/utils/test-utils";
import {describe, it, expect} from "vitest";
import { HistoryList } from "./index";

describe("HistoryList", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <HistoryList
        allItems={[]}
        total={0}
        hasNextPage={false}
        isFetchingNextPage={false}
        fetchNextPage={() => {}}
        onSelect={() => {}}
      />,
    );
    expect(container).toBeTruthy();
  });
});
