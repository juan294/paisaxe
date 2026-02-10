/**
 * Resend email utility for sending transactional emails from paisaxe.es.
 *
 * Supports: booking confirmations, admin notifications, welcome emails, etc.
 * Uses Resend SDK with typed interfaces and error handling.
 *
 * IMPORTANT: Always .trim() the API key per project conventions
 * (Vercel env vars may have invisible trailing whitespace).
 */

import { Resend } from "resend";

/** Default sender address for Paisaxe emails */
const DEFAULT_FROM = "Paisaxe <no-reply@paisaxe.es>";

/** Default admin recipient */
const DEFAULT_ADMIN_EMAIL = "admin@paisaxe.es";

export interface SendEmailOptions {
  /** Recipient email address(es) */
  to: string | string[];
  /** Email subject line */
  subject: string;
  /** HTML body content */
  html?: string;
  /** Plain text body content (alternative to html) */
  text?: string;
  /** Sender address (defaults to "Paisaxe <no-reply@paisaxe.es>") */
  from?: string;
  /** Reply-to address */
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export interface AdminNotificationOptions {
  /** Subject line (will be prefixed with "[Paisaxe Admin]") */
  subject: string;
  /** HTML body content */
  html: string;
}

/**
 * Send an email via Resend.
 *
 * Creates a new Resend client on each call to ensure the API key
 * is always read fresh from the environment (important for testing
 * and for cases where env vars are updated at runtime).
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    console.error("[email] Missing RESEND_API_KEY");
    return {
      success: false,
      error: "Resend not configured",
    };
  }

  try {
    const resend = new Resend(apiKey);

    // Build payload for the non-template variant of CreateEmailOptions.
    // We must include at least one of html/text and explicitly set template to never.
    const payload: {
      from: string;
      to: string | string[];
      subject: string;
      html?: string;
      text?: string;
      reply_to?: string;
    } = {
      from: options.from ?? DEFAULT_FROM,
      to: options.to,
      subject: options.subject,
    };

    if (options.html) {
      payload.html = options.html;
    }
    if (options.text) {
      payload.text = options.text;
    }
    if (options.replyTo) {
      payload.reply_to = options.replyTo;
    }

    const { data, error } = await resend.emails.send(payload as Parameters<typeof resend.emails.send>[0]);

    if (error) {
      console.error("[email] Resend API error:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      id: data?.id,
    };
  } catch (error) {
    console.error("[email] Failed to send email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send an admin notification email.
 *
 * Convenience wrapper around sendEmail that:
 * - Sends to the configured admin email (ADMIN_EMAIL env var, or admin@paisaxe.es)
 * - Prefixes subject with "[Paisaxe Admin]"
 * - Uses the default no-reply sender
 */
export async function sendAdminNotification(
  options: AdminNotificationOptions
): Promise<SendEmailResult> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL;

  return sendEmail({
    to: adminEmail,
    subject: `[Paisaxe Admin] ${options.subject}`,
    html: options.html,
  });
}
