import { DomainError } from "./domain";
export async function readBody(request: Request, maxBytes: number) {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) throw new DomainError("La requête dépasse la taille autorisée.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new DomainError("Requête vide.", 400);
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.length;
    if (size > maxBytes) { await reader.cancel(); throw new DomainError("La requête dépasse la taille autorisée.", 413); }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
