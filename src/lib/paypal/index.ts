/**
 * The PayPal adapter (PayPal hackathon plan, Phase 4). Booking code imports
 * from here only; @paypal/paypal-server-sdk types stay inside src/lib/paypal.
 */
export { authorizeOrder, captureAuthorization, getAuthorization, voidAuthorization } from "./authorizations";
export { valueToCents } from "./money";
export { cancelInvoice, createInvoice, getInvoice, sendInvoice } from "./invoices";
export { captureOrder, createOrder, getOrder } from "./orders";
export { getCapture, getRefund, refundCapture } from "./payments";
export { MAX_SEARCH_RANGE_MS, searchTransactions } from "./transactions";
export { verifyWebhookSignature } from "./webhooks";
export * from "./types";
