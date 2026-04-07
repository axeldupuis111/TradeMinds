export function SkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="skeleton h-3 w-24 mb-3" />
      <div className="skeleton h-7 w-16" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 py-3">
      <div className="skeleton h-3 w-16" />
      <div className="skeleton h-3 w-20" />
      <div className="skeleton h-5 w-12 rounded-full" />
      <div className="flex-1" />
      <div className="skeleton h-3 w-14" />
    </div>
  );
}

export function SkeletonText({ width = "w-full" }: { width?: string }) {
  return <div className={`skeleton h-3 ${width}`} />;
}

export function SkeletonBlock({ lines = 3 }: { lines?: number }) {
  const widths = ["w-full", "w-3/4", "w-5/6", "w-2/3", "w-4/5"];
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`skeleton h-3 ${widths[i % widths.length]}`} />
      ))}
    </div>
  );
}
