import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  AnalyticsCacheProvider,
  useAnalyticsData,
} from "./analytics-cache-context";

afterEach(cleanup);

it("subscribes both concurrent analytics consumers to one result and retries rejection with stale data", async () => {
  let resolve!: (value: { data: string }) => void;
  const fetchData = vi.fn(
    () =>
      new Promise<{ data: string }>((done) => {
        resolve = done;
      }),
  );
  function Consumer({ name }: { name: string }) {
    const result = useAnalyticsData("sharing", fetchData, "same");
    return (
      <section aria-label={name}>
        <span>{result.data ?? "loading"}</span>
        <span>{result.error}</span>
        <button onClick={result.refresh}>Retry {name}</button>
      </section>
    );
  }
  render(
    <AnalyticsCacheProvider>
      <Consumer name="one" />
      <Consumer name="two" />
    </AnalyticsCacheProvider>,
  );
  expect(fetchData).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolve({ data: "shared result" });
  });
  await waitFor(() =>
    expect(screen.getAllByText("shared result")).toHaveLength(2),
  );
  fetchData.mockRejectedValueOnce(new Error("offline"));
  await act(async () => {
    screen.getByText("Retry one").click();
  });
  await waitFor(() => expect(screen.getAllByText("offline")).toHaveLength(2));
  expect(screen.getAllByText("shared result")).toHaveLength(2);
  fetchData.mockResolvedValueOnce({ data: "recovered" });
  await act(async () => {
    screen.getByText("Retry two").click();
  });
  await waitFor(() => expect(screen.getAllByText("recovered")).toHaveLength(2));
  expect(fetchData).toHaveBeenCalledTimes(3);
});
