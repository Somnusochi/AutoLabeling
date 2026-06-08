/**
 * Repeatedly calls fetchNextPage until all pages are loaded.
 * Returns [loadingAll, handleLoadAll] for button state and onClick.
 */
export function useLoadAll(fetchNextPage: () => Promise<unknown>) {
  const [loadingAll, setLoadingAll] = useState(false);

  const handleLoadAll = useCallback(() => {
    setLoadingAll(true);
    const loadNext = () => {
      fetchNextPage().then((result: unknown) => {
        const pages = (result as { data?: { pages?: { items: unknown[]; total: number }[] } })?.data
          ?.pages;
        if (!pages) {
          setLoadingAll(false);
          return;
        }
        const totalFetched = pages.reduce((s, p) => s + (p.items?.length ?? 0), 0);
        const total = pages[0]?.total ?? 0;
        if (totalFetched >= total) {
          setLoadingAll(false);
          return;
        }
        loadNext();
      });
    };
    loadNext();
  }, [fetchNextPage]);

  return [loadingAll, handleLoadAll] as const;
}
