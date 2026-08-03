export async function GET() {
  return Response.json({ status: "ok", version: "1.0.6", storage: "cloud" }, { headers: { "Cache-Control": "no-store" } });
}
