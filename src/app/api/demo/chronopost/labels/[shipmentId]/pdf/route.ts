import { assertLocalRequest } from "@/lib/guard";
import { readChronopostPdf } from "@/lib/chronopost";
import { chronopostErrorResponse } from "@/lib/chronopost-http";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ shipmentId: string }> }) {
  try { assertLocalRequest(request); const { shipmentId } = await context.params; const pdf = await readChronopostPdf(shipmentId);
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="chronopost-${shipmentId}.pdf"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }); }
  catch (error) { return chronopostErrorResponse(error); }
}
