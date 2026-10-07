import { FreshnessBadge } from "paisaxe";

export const New = () => (
  <div className="p-6">
    <FreshnessBadge storyId="lagos-de-covadonga" createdAt={new Date().toISOString()} />
  </div>
);
