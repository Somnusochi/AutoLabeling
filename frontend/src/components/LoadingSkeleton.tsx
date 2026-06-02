export function DetectionSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-64 rounded-lg bg-gray-200" />
      <div className="h-4 w-48 rounded bg-gray-200" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 rounded bg-gray-100" />
        ))}
      </div>
    </div>
  );
}

export function HistorySkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-16 rounded bg-gray-100" />
      ))}
    </div>
  );
}
