import { assertLocalRequest } from "@/lib/guard";
import { readChronopostPdf } from "@/lib/chronopost";
import { chronopostErrorResponse } from "@/lib/chronopost-http";
import { isSupabaseMode } from "@/lib/supabase/config";
import { sharedChronopostPdfUrl } from "@/lib/chronopost-cloud";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ shipmentId: string }> }) {
  try { await assertLocalRequest(request); const { shipmentId } = await context.params;
    if (isSupabaseMode()) return new Response(null, { status: 307, headers: { Location: await sharedChronopostPdfUrl(shipmentId), "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
    const pdf = await readChronopostPdf(shipmentId);
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="chronopost-${shipmentId}.pdf"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }); }
  catch (error) { return chronopostErrorResponse(error); }
}
