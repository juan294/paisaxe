export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="h-14 bg-neutral-100 dark:bg-neutral-900 animate-pulse" />
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
        <div className="h-64 bg-neutral-100 dark:bg-neutral-900 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
