import { readFileSync } from "fs";

const raw = readFileSync(
  "/Users/juan/.claude/projects/-Users-juan-Documents-GenAI-Projects-paisaxe/3f83855d-48db-4da2-9dbe-ac87d086005a/tool-results/toolu_01F8xJNCyT1SfoU2WeXCXDFv.txt",
  "utf-8"
);
const data = JSON.parse(raw.replace(/^\[dotenv.*\n/, ""));

// ElevenLabs conversations summary
const convos = data.elevenlabs.conversations.conversations || [];
const febStart = new Date("2026-02-01").getTime() / 1000;
const febConvos = convos.filter((c) => c.start_time_unix_secs >= febStart);

let totalDuration = 0;
let successCount = 0;
let failCount = 0;
let vgCount = 0,
  vgDuration = 0;
let bkCount = 0,
  bkDuration = 0;

const dailyMap = {};

for (const c of febConvos) {
  const date = new Date(c.start_time_unix_secs * 1000)
    .toISOString()
    .split("T")[0];
  if (dailyMap[date] === undefined) {
    dailyMap[date] = { convos: 0, duration: 0, vg: 0, bk: 0 };
  }
  dailyMap[date].convos++;
  dailyMap[date].duration += c.call_duration_secs;

  totalDuration += c.call_duration_secs;
  if (c.call_successful === "success") successCount++;
  else failCount++;

  if (c.agent_name?.includes("Visitor Guide")) {
    vgCount++;
    vgDuration += c.call_duration_secs;
    dailyMap[date].vg++;
  } else if (c.agent_name?.includes("Booking")) {
    bkCount++;
    bkDuration += c.call_duration_secs;
    dailyMap[date].bk++;
  }
}

console.log("=== ELEVENLABS SUMMARY ===");
console.log("Total Feb conversations:", febConvos.length);
console.log("Successful:", successCount, "Failed:", failCount);
console.log("Total duration (min):", (totalDuration / 60).toFixed(1));
console.log(
  "Visitor Guide:",
  vgCount,
  "convos,",
  (vgDuration / 60).toFixed(1),
  "min"
);
console.log(
  "Booking:",
  bkCount,
  "convos,",
  (bkDuration / 60).toFixed(1),
  "min"
);
console.log(
  "Avg duration (successful, sec):",
  successCount > 0 ? (totalDuration / successCount).toFixed(1) : "N/A"
);
console.log();

// Subscription info
const sub = data.elevenlabs.subscription;
console.log("=== SUBSCRIPTION ===");
console.log("Tier:", sub.tier);
console.log("Characters used:", sub.character_count, "/", sub.character_limit);
console.log(
  "Character utilization:",
  ((sub.character_count / sub.character_limit) * 100).toFixed(1) + "%"
);
console.log(
  "Next reset:",
  new Date(sub.next_character_count_reset_unix * 1000).toISOString()
);
console.log();

// Daily breakdown sorted
console.log("=== DAILY VOICE BREAKDOWN ===");
for (const date of Object.keys(dailyMap).sort()) {
  const d = dailyMap[date];
  console.log(
    date,
    "| Convos:",
    d.convos,
    "| Duration:",
    (d.duration / 60).toFixed(1),
    "min | VG:",
    d.vg,
    "| BK:",
    d.bk
  );
}
console.log();

// Twilio
console.log("=== TWILIO BALANCE ===");
console.log(JSON.stringify(data.twilio.balance, null, 2));
console.log();

// Filter interesting Twilio usage categories
const twilioRecords = data.twilio.usageThisMonth?.usage_records || [];
const interestingCategories = [
  "sms",
  "sms-outbound",
  "calls",
  "calls-outbound",
  "recordings",
  "totalprice",
  "amazon-polly",
];
const relevantRecords = twilioRecords.filter(
  (r) =>
    parseFloat(r.price) > 0 || interestingCategories.includes(r.category)
);
console.log("=== TWILIO USAGE (non-zero + key) ===");
for (const r of relevantRecords) {
  console.log(
    r.category,
    "| Usage:",
    r.usage,
    r.usage_unit,
    "| Price:",
    r.price,
    r.price_unit
  );
}
console.log();

// Stripe
console.log("=== STRIPE BALANCE ===");
console.log(JSON.stringify(data.stripe.balance, null, 2));
console.log();

console.log("=== STRIPE TRANSACTIONS ===");
const txns = data.stripe.transactions?.data || [];
for (const t of txns) {
  const date = new Date(t.created * 1000).toISOString().split("T")[0];
  const time = new Date(t.created * 1000)
    .toISOString()
    .split("T")[1]
    .substring(0, 5);
  console.log(
    date,
    time,
    "|",
    t.type,
    "|",
    t.currency,
    (t.amount / 100).toFixed(2),
    "| Fee:",
    (t.fee / 100).toFixed(2),
    "| Net:",
    (t.net / 100).toFixed(2),
    "|",
    t.description || ""
  );
}
