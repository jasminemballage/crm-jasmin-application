import { assertLocalRequest } from "@/lib/guard";
import { readBody } from "@/lib/http-body";
import { demoRepository } from "@/lib/repository";
import { createChronopostLabel, readChronopostLabel } from "@/lib/chronopost";
import { getChronopostSettings } from "@/lib/chronopost-settings";
import { chronopostErrorResponse } from "@/lib/chronopost-http";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function GET(request: Request) {
  try { await assertLocalRequest(request); return Response.json(await readChronopostLabel(new URL(request.url).searchParams.get("shipmentId") ?? ""), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return chronopostErrorResponse(error); }
}
export async function POST(request: Request) {
  try { await assertLocalRequest(request, true); const input = JSON.parse((await readBody(request, 10000)).toString("utf8"));
    return Response.json(await createChronopostLabel(input, await demoRepository.read(), await getChronopostSettings(), { signal: request.signal }), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return chronopostErrorResponse(error); }
}
