import { z } from "zod";
import { actionSchema } from "@/lib/model";
import { demoRepository } from "@/lib/repository";
import { assertLocalRequest } from "@/lib/guard";
import { DomainError } from "@/lib/domain";
import { validateLocalImages } from "@/lib/media";
export const runtime = "nodejs";
const bodySchema = z.object({ revision: z.number().int().min(0), action: actionSchema });
const MAX_BODY_BYTES = 1_048_576;
export async function POST(request: Request) {
  try {
    assertLocalRequest(request, true);
    if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) throw new DomainError("Requête trop volumineuse (1 Mo maximum).", 413);
    const reader = request.body?.getReader();
    if (!reader) throw new DomainError("Requête vide.", 400);
    let size = 0; const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new DomainError("Requête trop volumineuse (1 Mo maximum).", 413); }
      chunks.push(value);
    }
    const input = bodySchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (input.action.type === "saveProductInfo") await validateLocalImages(input.action.product.info.images);
    return Response.json(await demoRepository.mutate(input.action, input.revision));
  } catch (error) {
    const message = error instanceof DomainError ? error.message : error instanceof z.ZodError ? "Certaines données sont invalides. Vérifiez les champs et les quantités saisis." : "L’action n’a pas pu être enregistrée.";
    return Response.json({ error: message }, { status: error instanceof DomainError ? error.status : error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 500 });
  }
}
