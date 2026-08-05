import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPECTED_SECRET_HASH = "8804116924228179e45667b5ba76f5dcbc205410c961a02bf4ab8b98de730e37";

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async request => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const secret = request.headers.get("x-autodogovor-sync-secret") || "";
  if (!secret || await sha256(secret) !== EXPECTED_SECRET_HASH) return new Response("Forbidden", { status: 403 });
  const payload = await request.json();
  if (!payload.id || !payload.owner_id || !payload.data) return Response.json({ error: "Invalid payload" }, { status: 400 });
  const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
  const key = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, key, { auth: { persistSession: false } });
  const { error } = await supabase.from("autodogovor_contracts").upsert({
    id: payload.id, owner_id: payload.owner_id, data: payload.data,
    created_at: new Date(payload.created_at).toISOString(), updated_at: new Date(payload.updated_at).toISOString(),
    deleted_at: payload.deleted_at ? new Date(payload.deleted_at).toISOString() : null, synced_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
});
