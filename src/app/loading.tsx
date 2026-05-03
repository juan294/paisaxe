export default function RootLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center bg-neutral-950"
    >
      <div
        aria-hidden="true"
        className="h-8 w-8 border-2 border-white/20 border-t-white rounded-full animate-spin motion-reduce:animate-none"
      />
      <p className="mt-3 text-sm text-neutral-500">Cargando...</p>
    </div>
  );
}
