import { assertLocalRequest } from "@/lib/guard";
import { readImage } from "@/lib/media";
import { DomainError } from "@/lib/domain";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  try {
    assertLocalRequest(request); const { filename } = await params; const image = await readImage(filename);
    return new Response(new Uint8Array(image.bytes), { headers: { "Content-Type": image.mime, "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox", "Cache-Control": "no-store" } });
  } catch (error) { return Response.json({ error: error instanceof DomainError ? error.message : "Lecture de l’image indisponible." }, { status: error instanceof DomainError ? error.status : 500 }); }
}
