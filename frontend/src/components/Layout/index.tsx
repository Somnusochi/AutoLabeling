import { Outlet } from "react-router-dom";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";

export function Layout() {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const isLoading = isFetching > 0 || isMutating > 0;

  return (
    <div className="flex h-screen bg-gray-50 relative">
      {isLoading && (
        <div className="absolute top-0 left-0 w-full h-[3px] z-[9999] overflow-hidden bg-primary-100 dark:bg-primary-900/50">
          <div className="h-full bg-primary-600 dark:bg-primary-500 w-1/3 animate-[slideRight_1.5s_infinite_linear]" />
        </div>
      )}
      <Outlet />
    </div>
  );
}
