#!/usr/bin/env npx tsx
/**
 * @deprecated Use `elevenlabs tools push` instead.
 * Tool configs are now tracked as code in tool_configs/.
 * See: tools.json
 *
 * Restore Pelayo's tools configuration
 *
 * This script recreates all webhook tools for the Pelayo agent after
 * they were accidentally corrupted.
 *
 * Usage: npx tsx scripts/fix-pelayo-booking-tool.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const API_KEY = process.env.ELEVENLABS_API_KEY;
const AGENT_ID = "agent_1201kgqhsdzxfkk9x7m1bjaew9mv";
const BASE_URL = "https://api.elevenlabs.io/v1";

if (!API_KEY) {
  console.error("Error: ELEVENLABS_API_KEY not found in .env.local");
  process.exit(1);
}

// All tools for Pelayo
const ALL_TOOLS = [
  // Weather tool
  {
    type: "webhook",
    name: "get_weather",
    description:
      "Get current weather for a city in Asturias or Picos de Europa. " +
      "Use this when the visitor asks about weather conditions. " +
      "Supported cities: Oviedo, Gijón, Avilés, Llanes, Cangas de Onís, Cudillero, " +
      "Luarca, Ribadesella, Covadonga, Picos de Europa, Fuente Dé.",
    api_schema: {
      url: "https://paisaxe.es/api/mcp/weather",
      method: "POST",
      request_headers: {
        "Content-Type": "application/json",
      },
      request_body_schema: {
        type: "object",
        required: ["city"],
        properties: {
          city: {
            type: "string",
            description:
              "City name for weather lookup. Infer from story context if user says 'here' or 'there'.",
          },
        },
      },
    },
  },
  // Places search tool
  {
    type: "webhook",
    name: "search_places",
    description:
      "Search for restaurants, hotels, attractions, or activities in Asturias. " +
      "Returns name, address, phone number, rating, and other details. " +
      "Use this when the visitor wants recommendations or is planning to visit somewhere.",
    api_schema: {
      url: "https://paisaxe.es/api/mcp/places",
      method: "POST",
      request_headers: {
        "Content-Type": "application/json",
      },
      request_body_schema: {
        type: "object",
        required: ["query"],
        properties: {
          query: {
            type: "string",
            description:
              "Search query (e.g., 'sidrerías en Gijón', 'hotel cerca de Covadonga', 'restaurante Casa Marcial')",
          },
          location: {
            type: "string",
            description: "Optional: specific city or area to search in",
          },
        },
      },
    },
  },
  // Make booking tool (FIXED with customer_phone)
  {
    type: "webhook",
    name: "make_booking",
    description:
      "Make an outbound call to a restaurant or business to book a reservation for the visitor. " +
      "Use this AFTER you have collected ALL required info: venue name, phone (from search_places), " +
      "party size, date, time, visitor's full name, and visitor's phone number.",
    api_schema: {
      url: "https://paisaxe.es/api/mcp/make-booking",
      method: "POST",
      request_headers: {
        "Content-Type": "application/json",
      },
      request_body_schema: {
        type: "object",
        description:
          "Booking request details. Before calling, you MUST have collected: " +
          "venue_name and phone_number (from search_places), party_size, date, time, " +
          "customer_name (full name), and customer_phone (visitor's callback number).",
        required: [
          "venue_name",
          "phone_number",
          "party_size",
          "date",
          "time",
          "customer_name",
          "customer_phone",
        ],
        properties: {
          venue_name: {
            type: "string",
            description: "Name of the venue (restaurant, hotel, activity provider) to call",
          },
          phone_number: {
            type: "string",
            description: "Phone number of the business (from search_places result)",
          },
          party_size: {
            type: "number",
            description: "Number of people for the reservation",
          },
          date: {
            type: "string",
            description:
              "Date for the reservation (e.g., 'hoy', 'mañana', 'el viernes', '15 de febrero')",
          },
          time: {
            type: "string",
            description: "Time for the reservation (e.g., '21:00', 'a las nueve de la noche')",
          },
          customer_name: {
            type: "string",
            description: "Visitor's FULL NAME for the reservation (e.g., 'Juan García López')",
          },
          customer_phone: {
            type: "string",
            description:
              "Visitor's phone number for the restaurant to call back if needed (e.g., '612345678', '+34612345678')",
          },
          special_requests: {
            type: "string",
            description:
              "Any special requests (e.g., 'trona para bebé', 'mesa en terraza', 'alergia al gluten')",
          },
        },
      },
    },
  },
  // System tools
  {
    type: "system",
    name: "end_call",
    description: "End the current call gracefully when the conversation is complete.",
  },
  {
    type: "system",
    name: "language_detection",
    description: "Detect and adapt to the visitor's language.",
  },
];

async function restoreTools(): Promise<void> {
  console.log("🔧 Restoring Pelayo's Tools\n");
  console.log("Tools to restore:");
  console.log("  - get_weather (weather for Asturias cities)");
  console.log("  - search_places (restaurants, hotels, attractions)");
  console.log("  - make_booking (FIXED: now includes customer_phone)");
  console.log("  - end_call (system)");
  console.log("  - language_detection (system)");
  console.log("");

  // Build update payload with all tools
  const updatePayload = {
    conversation_config: {
      agent: {
        prompt: {
          tools: ALL_TOOLS,
        },
      },
    },
  };

  console.log("📤 Updating agent tools...");

  const response = await fetch(`${BASE_URL}/convai/agents/${AGENT_ID}`, {
    method: "PATCH",
    headers: {
      "xi-api-key": API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updatePayload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update agent: ${response.status} - ${error}`);
  }

  const result = await response.json();
  console.log("✅ Tools restored successfully!");
  console.log(`   Agent ID: ${result.agent_id}`);
}

async function main(): Promise<void> {
  try {
    await restoreTools();

    console.log("\n📋 make_booking now has these parameters:");
    console.log("   Required: venue_name, phone_number, party_size, date, time,");
    console.log("             customer_name, customer_phone");
    console.log("   Optional: special_requests");

    console.log("\n🎉 Done! Run 'npx tsx scripts/check-pelayo-config.ts' to verify.");
  } catch (error) {
    console.error("\n❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
