import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const originalEnv = process.env;

describe("email", () => {
  const mockSend = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    process.env = {
      ...originalEnv,
      RESEND_API_KEY: "re_test_123456789",
    };

    vi.doMock("resend", () => ({
      Resend: class MockResend {
        constructor(public apiKey: string) {}
        emails = { send: mockSend };
      },
    }));
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("sendEmail", () => {
    it("should return error when RESEND_API_KEY is missing", async () => {
      delete process.env.RESEND_API_KEY;
      const { sendEmail } = await import("./email");

      const result = await sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Resend not configured");
    });

    it("should return error when RESEND_API_KEY is empty string", async () => {
      process.env.RESEND_API_KEY = "";
      const { sendEmail } = await import("./email");

      const result = await sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Resend not configured");
    });

    it("should return error when RESEND_API_KEY is only whitespace", async () => {
      process.env.RESEND_API_KEY = "   ";
      const { sendEmail } = await import("./email");

      const result = await sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Resend not configured");
    });

    it("should send email successfully with minimal options", async () => {
      const { sendEmail } = await import("./email");

      mockSend.mockResolvedValueOnce({
        data: { id: "email-id-456" },
        error: null,
      });

      const result = await sendEmail({
        to: "user@example.com",
        subject: "Welcome to Paisaxe",
        html: "<h1>Welcome!</h1>",
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe("email-id-456");
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "Paisaxe <no-reply@paisaxe.es>",
          to: "user@example.com",
          subject: "Welcome to Paisaxe",
          html: "<h1>Welcome!</h1>",
        })
      );
    });

    it("should send email with custom from address", async () => {
      const { sendEmail } = await import("./email");

      mockSend.mockResolvedValueOnce({
        data: { id: "email-id-789" },
        error: null,
      });

      const result = await sendEmail({
        to: "user@example.com",
        subject: "Booking Confirmation",
        html: "<p>Your booking is confirmed</p>",
        from: "Pelayo <pelayo@paisaxe.es>",
      });

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "Pelayo <pelayo@paisaxe.es>",
        })
      );
    });

    it("should send email to multiple recipients", async () => {
      const { sendEmail } = await import("./email");

      mockSend.mockResolvedValueOnce({
        data: { id: "email-id-multi" },
        error: null,
      });

      const result = await sendEmail({
        to: ["user1@example.com", "user2@example.com"],
        subject: "Team Update",
        html: "<p>Update</p>",
      });

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["user1@example.com", "user2@example.com"],
        })
      );
    });

    it("should support text-only emails", async () => {
      const { sendEmail } = await import("./email");

      mockSend.mockResolvedValueOnce({
        data: { id: "email-id-text" },
        error: null,
      });

      const result = await sendEmail({
        to: "user@example.com",
        subject: "Plain text",
        text: "Hello, this is plain text.",
      });

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "Hello, this is plain text.",
        })
      );
    });

    it("should support reply-to header", async () => {
      const { sendEmail } = await import("./email");

      mockSend.mockResolvedValueOnce({
        data: { id: "email-id-reply" },
        error: null,
      });

      const result = await sendEmail({
        to: "user@example.com",
        subject: "Contact us",
        html: "<p>Reply to this email</p>",
        replyTo: "support@paisaxe.es",
      });

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          reply_to: "support@paisaxe.es",
        })
      );
    });

    it("should handle Resend API errors", async () => {
      const { sendEmail } = await import("./email");

      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: "Invalid email address", name: "validation_error" },
      });

      const result = await sendEmail({
        to: "invalid-email",
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid email address");
    });

    it("should handle unexpected exceptions", async () => {
      const { sendEmail } = await import("./email");

      mockSend.mockRejectedValueOnce(new Error("Network timeout"));

      const result = await sendEmail({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network timeout");
    });

    it("should handle non-Error exceptions", async () => {
      const { sendEmail } = await import("./email");

      mockSend.mockRejectedValueOnce("Some string error");

      const result = await sendEmail({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error");
    });
  });

  describe("sendAdminNotification", () => {
    it("should send to admin email with correct defaults", async () => {
      const { sendAdminNotification } = await import("./email");

      mockSend.mockResolvedValueOnce({
        data: { id: "admin-email-1" },
        error: null,
      });

      const result = await sendAdminNotification({
        subject: "New booking received",
        html: "<p>A new booking was submitted</p>",
      });

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "Paisaxe <no-reply@paisaxe.es>",
          to: "admin@paisaxe.es",
          subject: "[Paisaxe Admin] New booking received",
        })
      );
    });

    it("should use custom admin email from env if set", async () => {
      process.env.ADMIN_EMAIL = "custom-admin@paisaxe.es";
      const { sendAdminNotification } = await import("./email");

      mockSend.mockResolvedValueOnce({
        data: { id: "admin-email-2" },
        error: null,
      });

      const result = await sendAdminNotification({
        subject: "Alert",
        html: "<p>Something happened</p>",
      });

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "custom-admin@paisaxe.es",
        })
      );
    });

    it("should propagate errors from sendEmail", async () => {
      delete process.env.RESEND_API_KEY;
      const { sendAdminNotification } = await import("./email");

      const result = await sendAdminNotification({
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Resend not configured");
    });
  });
});
