export default function FavoritesLoading() {
  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="h-14 bg-neutral-900" />
      <div className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse bg-neutral-800 rounded-lg aspect-[4/3]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
