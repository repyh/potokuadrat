import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export function getStorageBucketName() {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  if (!bucket) {
    throw new Error("SUPABASE_STORAGE_BUCKET must name the configured Storage bucket.");
  }
  return bucket;
}

export async function getStorageBucket() {
  const supabase = await createSupabaseServerClient();
  return supabase.storage.from(getStorageBucketName());
}
