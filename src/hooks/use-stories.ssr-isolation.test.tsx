import { renderToString } from "react-dom/server";
import { afterEach, expect, it } from "vitest";
import { StoriesProvider, useStories, clearStoriesCache } from "./use-stories";
import type { Story } from "@/types/immersive";

afterEach(clearStoriesCache);
it("keeps server seeds local to their render without mutating the browser cache", () => {
  clearStoriesCache();
  const seed: Story = {
    id: "private-render-seed",
    slug: "seed",
    title: "Unique server seed",
    subtitle: "",
    description: "",
    image: "",
    category: "nature",
    sourcePdf: "",
  };
  function Consumer() {
    return (
      <div>
        {useStories()
          .stories.map((story) => story.title)
          .join(",")}
      </div>
    );
  }
  expect(
    renderToString(
      <StoriesProvider initialStories={[seed]}>
        <Consumer />
      </StoriesProvider>,
    ),
  ).toContain(seed.title);
  expect(
    renderToString(
      <StoriesProvider>
        <Consumer />
      </StoriesProvider>,
    ),
  ).not.toContain(seed.title);
});
