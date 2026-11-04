import { assertLocalRequest } from "@/lib/guard";
import { readBody } from "@/lib/http-body";
import { MAX_IMAGE_BYTES, storeImage } from "@/lib/media";
import { DomainError } from "@/lib/domain";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertLocalRequest(request, true, "image");
    const bytes = await readBody(request, MAX_IMAGE_BYTES);
    return Response.json(await storeImage(bytes, { kind: "uploaded", alt: "Photo du produit" }));
  } catch (error) { return Response.json({ error: error instanceof DomainError ? error.message : "L’image n’a pas pu être enregistrée." }, { status: error instanceof DomainError ? error.status : 500 }); }
}
