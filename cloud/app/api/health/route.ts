export async function GET() {
  return Response.json({ status: "ok", version: "1.0.7.1", storage: "cloud", archive: "d1+supabase" }, { headers: { "Cache-Control": "no-store" } });
}
