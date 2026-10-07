import { FreshnessBadge, UserSubmittedBadge } from "paisaxe";

export const Default = () => (
  <div className="p-6">
    <UserSubmittedBadge />
  </div>
);

export const BesideNew = () => (
  <div className="p-6 flex flex-wrap items-center gap-2">
    <FreshnessBadge storyId="mirador-del-fitu" createdAt={new Date().toISOString()} />
    <UserSubmittedBadge />
  </div>
);
