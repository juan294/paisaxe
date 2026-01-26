const MAX_MESSAGE_LENGTH = 500;
const MAX_CONTEXT_LENGTH = 600;

// Strip control chars except \n, and strip zero-width characters
const CONTROL_CHARS_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200B\u200C\u200D\uFEFF]/g;
// Collapse 2+ whitespace chars to single space
const COLLAPSE_WHITESPACE_REGEX = /\s{2,}/g;

export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(CONTROL_CHARS_REGEX, '')
    .replace(COLLAPSE_WHITESPACE_REGEX, ' ');
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitizedMessage?: string;
  sanitizedContext?: string;
}

export function validateChatRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const { message, context } = body as Record<string, unknown>;

  // Validate message
  if (message === undefined || message === null) {
    return { valid: false, error: 'Message is required' };
  }

  if (typeof message !== 'string') {
    return { valid: false, error: 'Message must be a string' };
  }

  const sanitizedMessage = sanitizeInput(message);

  if (sanitizedMessage.length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }

  if (sanitizedMessage.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` };
  }

  // Validate context (optional)
  let sanitizedContext: string | undefined;

  if (context !== undefined) {
    if (typeof context !== 'string') {
      return { valid: false, error: 'Context must be a string' };
    }

    sanitizedContext = sanitizeInput(context);

    if (sanitizedContext.length > MAX_CONTEXT_LENGTH) {
      return { valid: false, error: `Context exceeds maximum length of ${MAX_CONTEXT_LENGTH} characters` };
    }
  }

  return {
    valid: true,
    sanitizedMessage,
    sanitizedContext,
  };
}
