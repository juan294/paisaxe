import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TunnelTableRow } from "./tunnel-control-panel";

// Mock the csrf-client module
vi.mock("@/lib/csrf-client", () => ({
  csrfHeaders: vi.fn(() => ({})),
}));

describe("TunnelTableRow", () => {
  const defaultProps = {
    rowNumber: 5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: tunnel is off
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ running: false, url: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  // Helper to wrap in table context
  const renderRow = (props: Parameters<typeof TunnelTableRow>[0] = defaultProps) => {
    return render(
      <table>
        <tbody>
          <TunnelTableRow {...props} />
        </tbody>
      </table>
    );
  };

  describe("rendering", () => {
    it("renders the Dev Tunnel label", async () => {
      renderRow();

      await waitFor(() => {
        expect(screen.getByText("Dev Tunnel")).toBeInTheDocument();
      });
    });

    it("renders the row number zero-padded", async () => {
      renderRow({ rowNumber: 5 });

      await waitFor(() => {
        expect(screen.getByText("05")).toBeInTheDocument();
      });
    });

    it("renders the toggle switch", async () => {
      renderRow();

      await waitFor(() => {
        expect(screen.getByRole("switch", { name: /toggle dev tunnel/i })).toBeInTheDocument();
      });
    });

    it("shows Off status when tunnel is not running", async () => {
      renderRow();

      await waitFor(() => {
        expect(screen.getByText("Off")).toBeInTheDocument();
      });
    });

    it("shows the default description when tunnel is off", async () => {
      renderRow();

      await waitFor(() => {
        expect(screen.getByText("Start tunnel to test ElevenLabs webhooks locally")).toBeInTheDocument();
      });
    });

    it("sets aria-checked to false when tunnel is off", async () => {
      renderRow();

      await waitFor(() => {
        const toggle = screen.getByRole("switch", { name: /toggle dev tunnel/i });
        expect(toggle).toHaveAttribute("aria-checked", "false");
      });
    });
  });

  describe("tunnel running state", () => {
    beforeEach(() => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({ running: true, url: "https://tunnel.example.com" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    });

    it("shows On status when tunnel is running", async () => {
      renderRow();

      await waitFor(() => {
        expect(screen.getByText("On")).toBeInTheDocument();
      });
    });

    it("sets aria-checked to true when tunnel is running", async () => {
      renderRow();

      await waitFor(() => {
        const toggle = screen.getByRole("switch", { name: /toggle dev tunnel/i });
        expect(toggle).toHaveAttribute("aria-checked", "true");
      });
    });

    it("shows the tunnel URL in the description", async () => {
      renderRow();

      await waitFor(() => {
        expect(screen.getByText("tunnel.example.com")).toBeInTheDocument();
      });
    });

    it("shows the external link icon with the tunnel URL", async () => {
      renderRow();

      await waitFor(() => {
        const links = screen.getAllByRole("link");
        const tunnelLink = links.find((l) => l.getAttribute("href") === "https://tunnel.example.com");
        expect(tunnelLink).toBeInTheDocument();
        expect(tunnelLink).toHaveAttribute("target", "_blank");
        expect(tunnelLink).toHaveAttribute("rel", "noopener noreferrer");
      });
    });

    it("notifies parent when tunnel is running on fetch", async () => {
      const onRunningChange = vi.fn();
      renderRow({ rowNumber: 5, onRunningChange });

      await waitFor(() => {
        expect(onRunningChange).toHaveBeenCalledWith(true);
      });
    });
  });

  describe("toggle behavior", () => {
    it("sends POST when turning on from off state", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      // Initial fetch: off
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ running: false, url: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
      // Toggle POST response: on
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ running: true, url: "https://tunnel.example.com" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const user = userEvent.setup();
      renderRow();

      await waitFor(() => {
        expect(screen.getByRole("switch")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("switch"));

      // Second call should be POST
      expect(fetchSpy).toHaveBeenCalledWith("/api/admin/tunnel", expect.objectContaining({
        method: "POST",
      }));
    });

    it("sends DELETE when turning off from on state", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      // Initial fetch: on
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ running: true, url: "https://tunnel.example.com" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
      // Toggle DELETE response: off
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ running: false, url: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const user = userEvent.setup();
      renderRow();

      await waitFor(() => {
        expect(screen.getByText("On")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("switch"));

      // Second call should be DELETE
      expect(fetchSpy).toHaveBeenCalledWith("/api/admin/tunnel", expect.objectContaining({
        method: "DELETE",
      }));
    });

    it("updates UI after successful toggle to on", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ running: false, url: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ running: true, url: "https://new-tunnel.dev" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const user = userEvent.setup();
      renderRow();

      await waitFor(() => {
        expect(screen.getByText("Off")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("switch"));

      await waitFor(() => {
        expect(screen.getByText("On")).toBeInTheDocument();
        expect(screen.getByText("new-tunnel.dev")).toBeInTheDocument();
      });
    });

    it("notifies parent of running state change on toggle", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ running: false, url: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ running: true, url: "https://tunnel.dev" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const onRunningChange = vi.fn();
      const user = userEvent.setup();
      renderRow({ rowNumber: 5, onRunningChange });

      await waitFor(() => {
        expect(screen.getByRole("switch")).toBeInTheDocument();
      });

      // First call from initial fetch
      expect(onRunningChange).toHaveBeenCalledWith(false);

      await user.click(screen.getByRole("switch"));

      await waitFor(() => {
        expect(onRunningChange).toHaveBeenCalledWith(true);
      });
    });

    it("disables toggle while updating", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ running: false, url: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
      // Make the toggle request hang
      fetchSpy.mockReturnValueOnce(new Promise(() => {}));

      const user = userEvent.setup();
      renderRow();

      await waitFor(() => {
        expect(screen.getByRole("switch")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("switch"));

      const toggle = screen.getByRole("switch");
      expect(toggle).toBeDisabled();
    });
  });

  describe("error handling", () => {
    it("shows error when initial status fetch fails", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

      renderRow();

      await waitFor(() => {
        expect(screen.getByText("(Failed to check tunnel status)")).toBeInTheDocument();
      });
    });

    it("shows error when toggle API returns an error response", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ running: false, url: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Port already in use" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      );

      const user = userEvent.setup();
      renderRow();

      await waitFor(() => {
        expect(screen.getByRole("switch")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("switch"));

      await waitFor(() => {
        expect(screen.getByText("(Port already in use)")).toBeInTheDocument();
      });
    });

    it("shows generic error message when toggle response has no error field", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ running: false, url: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      );

      const user = userEvent.setup();
      renderRow();

      await waitFor(() => {
        expect(screen.getByRole("switch")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("switch"));

      await waitFor(() => {
        expect(screen.getByText("(Failed to toggle tunnel)")).toBeInTheDocument();
      });
    });

    it("shows error when toggle fetch throws", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ running: false, url: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
      fetchSpy.mockRejectedValueOnce(new Error("Network failure"));

      const user = userEvent.setup();
      renderRow();

      await waitFor(() => {
        expect(screen.getByRole("switch")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("switch"));

      await waitFor(() => {
        expect(screen.getByText("(Failed to toggle tunnel)")).toBeInTheDocument();
      });
    });

    it("clears error on retry when toggle succeeds", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      // Initial status fetch
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ running: false, url: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
      // First toggle: fails
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Temporary failure" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      );
      // Second toggle: succeeds
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ running: true, url: "https://tunnel.dev" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const user = userEvent.setup();
      renderRow();

      await waitFor(() => {
        expect(screen.getByRole("switch")).toBeInTheDocument();
      });

      // First click: error
      await user.click(screen.getByRole("switch"));
      await waitFor(() => {
        expect(screen.getByText("(Temporary failure)")).toBeInTheDocument();
      });

      // Second click: success, error should clear
      await user.click(screen.getByRole("switch"));
      await waitFor(() => {
        expect(screen.queryByText("(Temporary failure)")).not.toBeInTheDocument();
        expect(screen.getByText("On")).toBeInTheDocument();
      });
    });
  });

  describe("production environment", () => {
    it("shows a disabled local development capability when API returns 403", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(null, { status: 403 })
      );

      renderRow();

      await waitFor(() => {
        // The row should not render anything (returns null)
        expect(screen.getByText(/Solo disponible en desarrollo local/)).toBeInTheDocument();
        expect(screen.getByRole("switch")).toBeDisabled();
      });
    });

    it("does nothing when initial fetch returns non-ok, non-403 status (line 39 false branch)", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(null, { status: 500 })
      );

      renderRow();

      // Should still render the row (not production), but with default off state
      await waitFor(() => {
        expect(screen.getByText("Dev Tunnel")).toBeInTheDocument();
      });

      // Should show Off (default state, since fetch didn't update status)
      expect(screen.getByText("Off")).toBeInTheDocument();
      // Should NOT show error (only catch block sets error)
      expect(screen.queryByText(/Failed/)).not.toBeInTheDocument();
    });
  });

  describe("initial status fetch", () => {
    it("fetches status from /api/admin/tunnel on mount", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      renderRow();

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith("/api/admin/tunnel");
      });
    });

    it("notifies parent of initial running state", async () => {
      const onRunningChange = vi.fn();
      renderRow({ rowNumber: 5, onRunningChange });

      await waitFor(() => {
        expect(onRunningChange).toHaveBeenCalledWith(false);
      });
    });
  });
});
