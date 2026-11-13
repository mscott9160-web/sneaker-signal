import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleUnsubscribe } from "./handler.ts";

// Deploy with: npx supabase functions deploy unsubscribe --no-verify-jwt
// Mail providers call it without any Supabase credentials.
Deno.serve((request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response("Unsubscribe is temporarily unavailable", { status: 503 });
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return handleUnsubscribe(request, async (token) => {
    const { error } = await admin.rpc("unsubscribe_by_token", { p_token: token });
    return { error: error?.message ?? null };
  });
});
