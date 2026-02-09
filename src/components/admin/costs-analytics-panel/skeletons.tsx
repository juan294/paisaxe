"use client";

export function SkeletonCostsDashboard() {
  return (
    <>
      <section className="grid grid-cols-2 gap-16 lg:grid-cols-4">
        {["rose", "orange", "blue", "emerald"].map((color) => (
          <SkeletonStatCard key={color} color={color as "rose" | "orange" | "blue" | "emerald"} />
        ))}
      </section>

      <section>
        <div className="mb-6 h-3 w-32 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]" />
        <SkeletonChart />
      </section>

      <section>
        <div className="mb-4 h-3 w-40 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]" />
        <SkeletonTable />
      </section>
    </>
  );
}

const skeletonColorClasses: Record<string, string> = {
  rose: "bg-rose-200 dark:bg-rose-900/30",
  orange: "bg-orange-200 dark:bg-orange-900/30",
  blue: "bg-blue-200 dark:bg-blue-900/30",
  emerald: "bg-emerald-200 dark:bg-emerald-900/30",
};

function SkeletonStatCard({ color }: { color: "rose" | "orange" | "blue" | "emerald" }) {
  return (
    <div>
      <div
        className={`h-12 w-28 animate-pulse rounded lg:h-16 lg:w-36 ${skeletonColorClasses[color]}`}
      />
      <div className="mt-4 h-3 w-24 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]" />
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="h-[200px] w-full max-w-3xl animate-pulse rounded bg-[#f5f3ee] dark:bg-[#2d2a26]" />
  );
}

function SkeletonTable() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-4">
          <div className="h-4 w-32 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]" />
          <div className="h-4 w-20 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]" />
          <div className="h-4 w-16 animate-pulse rounded bg-rose-200 dark:bg-rose-900/30" />
          <div className="h-4 w-16 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]" />
        </div>
      ))}
    </div>
  );
}
