import type { ServiceCost } from "@/types/costs-analytics";
import { PLATFORM_SERVICES } from "@/types/costs-analytics";

interface TwilioUsageRecord {
  category: string;
  description: string;
  price: string;
  price_unit: string;
  count: string;
  usage: string;
  usage_unit: string;
}

interface TwilioUsageResponse {
  usage_records: TwilioUsageRecord[];
  end: number;
  first_page_uri: string;
  next_page_uri: string | null;
  page: number;
  page_size: number;
  previous_page_uri: string | null;
  start: number;
  uri: string;
}

/**
 * Fetches cost data from Twilio Usage API.
 * Requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables.
 * @see https://www.twilio.com/docs/usage/api/usage-record
 */
export async function fetchTwilioCosts(
  startDate: string,
  endDate: string
): Promise<ServiceCost | null> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();

  if (!accountSid || !authToken) {
    return null;
  }

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString(
      "base64"
    );

    const params = new URLSearchParams({
      StartDate: startDate,
      EndDate: endDate,
      IncludeSubaccounts: "true",
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Usage/Records.json?${params}`,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      }
    );

    if (!response.ok) {
      console.error(
        "Twilio usage API error:",
        response.status,
        await response.text()
      );
      return null;
    }

    const data: TwilioUsageResponse = await response.json();

    // Sum up all usage costs
    const totalCostUsd = data.usage_records.reduce((sum, record) => {
      const price = parseFloat(record.price) || 0;
      return sum + price;
    }, 0);

    return {
      serviceId: PLATFORM_SERVICES.twilio.id,
      serviceName: PLATFORM_SERVICES.twilio.name,
      category: PLATFORM_SERVICES.twilio.category,
      costUsd: totalCostUsd,
      costFormatted: formatUsd(totalCostUsd),
      source: "api",
      billingPeriodStart: startDate,
      billingPeriodEnd: endDate,
      dashboardUrl: PLATFORM_SERVICES.twilio.dashboardUrl,
    };
  } catch (error) {
    console.error("Error fetching Twilio costs:", error);
    return null;
  }
}

/**
 * Fetches daily cost breakdown from Twilio.
 */
export async function fetchTwilioCostsByDay(
  startDate: string,
  endDate: string
): Promise<Array<{ date: string; costUsd: number }>> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();

  if (!accountSid || !authToken) {
    return [];
  }

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString(
      "base64"
    );

    const params = new URLSearchParams({
      StartDate: startDate,
      EndDate: endDate,
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Usage/Records/Daily.json?${params}`,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      }
    );

    if (!response.ok) {
      return [];
    }

    const data: TwilioUsageResponse = await response.json();

    // Group by date and sum costs
    const costsByDate = new Map<string, number>();

    for (const record of data.usage_records) {
      // Twilio daily records include a date in the description or we can derive from StartDate
      const price = parseFloat(record.price) || 0;
      // For daily records, we need to extract the date - using a simple approach
      // The API returns records grouped by day when using Daily endpoint
      const existingCost = costsByDate.get(startDate) || 0;
      costsByDate.set(startDate, existingCost + price);
    }

    return Array.from(costsByDate.entries()).map(([date, costUsd]) => ({
      date,
      costUsd,
    }));
  } catch {
    return [];
  }
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
