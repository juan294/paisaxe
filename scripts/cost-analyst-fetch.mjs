import { config } from "dotenv";
config({ path: ".env.local" });

const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY?.trim();
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID?.trim();
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN?.trim();
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY?.trim();

const start = Math.floor(new Date("2026-02-01T00:00:00Z").getTime() / 1000);
const end = Math.floor(Date.now() / 1000);

async function fetchJSON(url, headers) {
  try {
    const res = await fetch(url, { headers });
    const data = await res.json();
    return data;
  } catch (e) {
    return { error: e.message };
  }
}

const twilioAuth = "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64");

const results = await Promise.all([
  // ElevenLabs
  fetchJSON(
    `https://api.elevenlabs.io/v1/usage/character-stats?start_unix=${start}&end_unix=${end}`,
    { "xi-api-key": ELEVENLABS_KEY }
  ),
  fetchJSON("https://api.elevenlabs.io/v1/user/subscription", {
    "xi-api-key": ELEVENLABS_KEY,
  }),
  // ElevenLabs ConvAI conversations
  fetchJSON("https://api.elevenlabs.io/v1/convai/conversations?page_size=100", {
    "xi-api-key": ELEVENLABS_KEY,
  }),
  // Twilio
  fetchJSON(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Usage/Records/ThisMonth.json`,
    { Authorization: twilioAuth }
  ),
  fetchJSON(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Balance.json`,
    { Authorization: twilioAuth }
  ),
  // Stripe
  fetchJSON("https://api.stripe.com/v1/balance", {
    Authorization: `Bearer ${STRIPE_KEY}`,
  }),
  fetchJSON(
    "https://api.stripe.com/v1/balance_transactions?limit=50&created[gte]=" + start,
    { Authorization: `Bearer ${STRIPE_KEY}` }
  ),
]);

const output = {
  timestamp: new Date().toISOString(),
  elevenlabs: {
    characterStats: results[0],
    subscription: results[1],
    conversations: results[2],
  },
  twilio: {
    usageThisMonth: results[3],
    balance: results[4],
  },
  stripe: {
    balance: results[5],
    transactions: results[6],
  },
};

console.log(JSON.stringify(output, null, 2));
