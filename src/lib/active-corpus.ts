import "server-only";
import { supabase } from "./supabase";

/** Resolve before cache access. Database/selector failures never imply legacy. */
export async function activeCorpusVersion(signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted();
  const query = supabase.rpc("active_corpus_version");
  const { data, error } = await (signal ? query.abortSignal(signal) : query);
  signal?.throwIfAborted();
  if (error || typeof data !== "string" || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(data)) throw new Error("Corpus selection unavailable");
  return data;
}
