import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client: bypasses row-level security. Server-only.
 * Never import this from a Client Component, and never prefix the key with NEXT_PUBLIC_.
 */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
