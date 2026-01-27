export default function ImmersiveLoading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black">
      <div className="h-8 w-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );
}
