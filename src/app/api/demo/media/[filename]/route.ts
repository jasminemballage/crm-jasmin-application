import { assertLocalRequest } from "@/lib/guard";
import { readImage, sharedImageUrl } from "@/lib/media";
import { isSupabaseMode } from "@/lib/supabase/config";
import { DomainError } from "@/lib/domain";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  try {
    await assertLocalRequest(request); const { filename } = await params;
    if (isSupabaseMode()) return new Response(null, { status: 307, headers: { Location: await sharedImageUrl(filename), "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
    const image = await readImage(filename);
    return new Response(new Uint8Array(image.bytes), { headers: { "Content-Type": image.mime, "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox", "Cache-Control": "no-store" } });
  } catch (error) { return Response.json({ error: error instanceof DomainError ? error.message : "Lecture de l’image indisponible." }, { status: error instanceof DomainError ? error.status : 500 }); }
}
