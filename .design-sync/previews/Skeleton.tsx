import { Skeleton } from "paisaxe";

export const TextLines = () => (
  <div className="p-6">
    <div className="space-y-2" style={{width: 360}}>
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-5/6" />
  </div>
  </div>
);

export const MediaCard = () => (
  <div className="p-6">
    <div className="flex items-center gap-4" style={{width: 360}}>
    <Skeleton className="h-12 w-12 rounded-full" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-full" />
    </div>
  </div>
  </div>
);
