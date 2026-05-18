export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="skeleton h-8 w-48 rounded-lg" />
        <div className="skeleton h-4 w-32 rounded mt-2" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="skeleton h-3 w-20 rounded" />
            <div className="skeleton h-7 w-24 rounded" />
            <div className="skeleton h-3 w-16 rounded" />
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="skeleton h-[280px] rounded-xl" />
        <div className="skeleton h-[280px] rounded-xl" />
      </div>

      {/* Recent trades */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="skeleton h-5 w-32 rounded" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="skeleton h-4 w-20 rounded" />
            <div className="skeleton h-4 w-16 rounded" />
            <div className="skeleton h-4 w-10 rounded" />
            <div className="flex-1" />
            <div className="skeleton h-4 w-14 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
