import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogOverlay,
  DialogPortal,
} from "./dialog";

describe("Dialog", () => {
  describe("Dialog and DialogTrigger", () => {
    it("should render trigger button", () => {
      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogTitle>Test Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      );
      expect(screen.getByRole("button", { name: "Open Dialog" })).toBeInTheDocument();
    });

    it("should open dialog when trigger is clicked", async () => {
      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent aria-describedby={undefined}>
            <DialogTitle>Test Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      fireEvent.click(screen.getByRole("button", { name: "Open Dialog" }));

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
    });

    it("should render as controlled dialog", async () => {
      const handleOpenChange = vi.fn();
      render(
        <Dialog open={true} onOpenChange={handleOpenChange}>
          <DialogContent>
            <DialogTitle>Controlled Dialog</DialogTitle>
            <DialogDescription>A controlled dialog</DialogDescription>
          </DialogContent>
        </Dialog>
      );
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  describe("DialogContent", () => {
    it("should render content when dialog is open", async () => {
      render(
        <Dialog defaultOpen>
          <DialogContent aria-describedby={undefined}>
            <DialogTitle>Dialog Title</DialogTitle>
            <p>Dialog content here</p>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Dialog content here")).toBeInTheDocument();
    });

    it("should have close button", async () => {
      render(
        <Dialog defaultOpen>
          <DialogContent aria-describedby={undefined}>
            <DialogTitle>Dialog Title</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByText("Close")).toBeInTheDocument();
    });

    it("should hide close button when hideCloseButton is true", async () => {
      render(
        <Dialog defaultOpen>
          <DialogContent aria-describedby={undefined} hideCloseButton>
            <DialogTitle>Dialog Title</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      expect(screen.queryByText("Close")).not.toBeInTheDocument();
    });

    it("should merge custom className", async () => {
      render(
        <Dialog defaultOpen>
          <DialogContent className="custom-dialog" data-testid="dialog-content" aria-describedby={undefined}>
            <DialogTitle>Title</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      const content = screen.getByRole("dialog");
      expect(content).toHaveClass("custom-dialog");
    });
  });

  describe("DialogHeader", () => {
    it("should render header with children", () => {
      render(
        <Dialog defaultOpen>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader data-testid="header">
              <DialogTitle>Header Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByTestId("header")).toBeInTheDocument();
      expect(screen.getByTestId("header")).toHaveClass("flex", "flex-col", "space-y-1.5");
    });

    it("should merge custom className", () => {
      render(
        <Dialog defaultOpen>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader className="custom-header" data-testid="header">
              <DialogTitle>Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByTestId("header")).toHaveClass("custom-header");
    });
  });

  describe("DialogFooter", () => {
    it("should render footer with children", () => {
      render(
        <Dialog defaultOpen>
          <DialogContent aria-describedby={undefined}>
            <DialogTitle>Title</DialogTitle>
            <DialogFooter data-testid="footer">
              <button>Cancel</button>
              <button>Confirm</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByTestId("footer")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    });

    it("should have responsive styles", () => {
      render(
        <Dialog defaultOpen>
          <DialogContent aria-describedby={undefined}>
            <DialogTitle>Title</DialogTitle>
            <DialogFooter data-testid="footer">Footer</DialogFooter>
          </DialogContent>
        </Dialog>
      );

      const footer = screen.getByTestId("footer");
      expect(footer).toHaveClass("flex", "flex-col-reverse", "sm:flex-row", "sm:justify-end");
    });
  });

  describe("DialogTitle", () => {
    it("should render title", () => {
      render(
        <Dialog defaultOpen>
          <DialogContent aria-describedby={undefined}>
            <DialogTitle>My Dialog Title</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByText("My Dialog Title")).toBeInTheDocument();
    });

    it("should have styling classes", () => {
      render(
        <Dialog defaultOpen>
          <DialogContent aria-describedby={undefined}>
            <DialogTitle data-testid="title">Title</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      const title = screen.getByTestId("title");
      expect(title).toHaveClass("text-lg", "font-semibold", "leading-none", "tracking-tight");
    });
  });

  describe("DialogDescription", () => {
    it("should render description", () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <DialogDescription>This is the description</DialogDescription>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByText("This is the description")).toBeInTheDocument();
    });

    it("should have styling classes", () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <DialogDescription data-testid="desc">Description</DialogDescription>
          </DialogContent>
        </Dialog>
      );

      const desc = screen.getByTestId("desc");
      expect(desc).toHaveClass("text-sm", "text-muted-foreground");
    });
  });

  describe("DialogClose", () => {
    it("should close dialog when clicked", async () => {
      render(
        <Dialog defaultOpen>
          <DialogContent aria-describedby={undefined}>
            <DialogTitle>Title</DialogTitle>
            <DialogClose data-testid="close-button">Close Me</DialogClose>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      fireEvent.click(screen.getByTestId("close-button"));

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA attributes", async () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Accessible Dialog</DialogTitle>
            <DialogDescription>Description for screen readers</DialogDescription>
          </DialogContent>
        </Dialog>
      );

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
    });
  });

  describe("Exports", () => {
    it("should export DialogPortal", () => {
      expect(DialogPortal).toBeDefined();
    });

    it("should export DialogOverlay", () => {
      expect(DialogOverlay).toBeDefined();
    });
  });
});
