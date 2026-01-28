import { Skeleton } from "@/components/ui/skeleton";

export function ChatMessageSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="max-w-[85%] p-3 rounded-2xl bg-white/20"
    >
      <div className="space-y-2">
        <Skeleton className="h-4 w-full bg-white/15" />
        <Skeleton className="h-4 w-4/5 bg-white/15" />
        <Skeleton className="h-4 w-3/5 bg-white/15" />
      </div>
    </div>
  );
}
