import { assertLocalRequest } from "@/lib/guard";
import { readBody } from "@/lib/http-body";
import { getChronopostSettings, publicChronopostStatus, saveChronopostSettings } from "@/lib/chronopost-settings";
import { chronopostErrorResponse } from "@/lib/chronopost-http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try { await assertLocalRequest(request); return Response.json(publicChronopostStatus(await getChronopostSettings()), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return chronopostErrorResponse(error); }
}
export async function POST(request: Request) {
  try { await assertLocalRequest(request, true); const input = JSON.parse((await readBody(request, 20000)).toString("utf8"));
    return Response.json(await saveChronopostSettings(input), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return chronopostErrorResponse(error); }
}
