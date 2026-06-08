import type { RefObject } from "react";

/**
 * Triggers fetchNextPage when scrollbar nears bottom of a container.
 * Use across all virtual lists to avoid duplicating scroll logic.
 */
export function useInfiniteScroll(
  containerRef: RefObject<HTMLElement | null>,
  hasNextPage: boolean,
  isFetchingNextPage: boolean,
  fetchNextPage: () => void,
  threshold = 100,
) {
  const fetchRef = useRef(fetchNextPage);
  useEffect(() => { fetchRef.current = fetchNextPage; });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight - scrollTop - clientHeight < threshold && hasNextPage && !isFetchingNextPage) {
        fetchRef.current();
      }
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [containerRef, hasNextPage, isFetchingNextPage, threshold]);
}
