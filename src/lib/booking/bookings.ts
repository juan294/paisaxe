/**
 * Booking reads scoped to the acting user (the booking chat's tools and its
 * per-turn state). A capability holder reads through
 * verifyBookingCapability in links.ts instead.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { mapBooking, type Booking } from "./types";

/** The user's booking, or null when it does not exist or belongs to someone else. */
export async function getBookingForUser(
  client: SupabaseClient,
  userId: string,
  bookingId: string
): Promise<Booking | null> {
  const { data, error } = await client
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load booking: ${error.message}`);
  return data ? mapBooking(data) : null;
}

export async function listBookingsForUser(client: SupabaseClient, userId: string): Promise<Booking[]> {
  const { data, error } = await client
    .from("bookings")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to list bookings: ${error.message}`);
  return (data ?? []).map(mapBooking);
}
