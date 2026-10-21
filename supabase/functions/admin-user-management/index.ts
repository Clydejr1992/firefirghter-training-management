import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey) return json({ error: "Server authentication is not configured." }, 503);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Sign-in required." }, 401);
  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false } });
  const token = authHeader.slice("Bearer ".length);
  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Your session is invalid. Sign in again." }, 401);

  const { data: profile, error: profileError } = await adminClient
    .from("firefighter_profiles").select("role,active").eq("id", userData.user.id).maybeSingle();
  if (profileError || !profile || profile.role !== "admin" || profile.active !== true) {
    return json({ error: "Administrator permission is required." }, 403);
  }

  let body: { action?: string; email?: string; full_name?: string; redirect_to?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }
  const action = body.action;
  const email = (body.email || "").trim().toLowerCase();
  const redirectTo = body.redirect_to || "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
  const allowedRedirect = "https://clydejr1992.github.io/firefirghter-training-management/";
  if (!allowedRedirect || redirectTo !== allowedRedirect) {
    return json({ error: "The approved portal redirect URL is not configured." }, 400);
  }

  if (action === "invite") {
    const fullName = (body.full_name || "").trim();
    if (!fullName) return json({ error: "Enter the firefighter's name." }, 400);
    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { full_name: fullName },
    });
    if (inviteError || !invited.user) return json({ error: inviteError?.message || "Could not send invitation." }, 400);
    const { error: insertError } = await adminClient.from("firefighter_profiles").upsert({
      id: invited.user.id, full_name: fullName, role: "firefighter", active: true,
    });
    if (insertError) return json({ error: "Invitation was created, but the profile could not be saved. Contact support." }, 500);
    return json({ ok: true });
  }

  if (action === "reset_password") {
    // The reset email is sent by Supabase Auth; no password is exposed to the administrator.
    const publicClient = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error: resetError } = await publicClient.auth.resetPasswordForEmail(email, { redirectTo });
    if (resetError) return json({ error: resetError.message }, 400);
    return json({ ok: true });
  }
  return json({ error: "Unsupported action." }, 400);
});
