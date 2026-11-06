import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DomainError } from "./domain";
import type { ImageAsset } from "./product-info";
import { isSupabaseMode } from "./supabase/config";
import { downloadPrivateObject, uploadPrivateObject, privateObjectUrl } from "./supabase/storage";
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
// Keep browser uploads below Vercel's request body limit. Existing/AI images may be larger.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const mediaName = /^[a-f0-9-]{36}\.(png|jpg|webp)$/;
export function mediaDirectory() {
  return process.env.CRM_DEMO_DATA_FILE
    ? path.join(path.dirname(path.resolve(process.cwd(), process.env.CRM_DEMO_DATA_FILE)), "media-tests")
    : path.join(process.cwd(), ".local", "media");
}
export function imageFormat(bytes: Uint8Array) {
  if (bytes.length < 12 || bytes.length > MAX_IMAGE_BYTES) throw new DomainError("Image vide, incomplète ou supérieure à 8 Mo.", 413);
  const head = Buffer.from(bytes);
  if (head.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return { ext: "png", mime: "image/png" };
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (head.toString("ascii", 0, 4) === "RIFF" && head.toString("ascii", 8, 12) === "WEBP") return { ext: "webp", mime: "image/webp" };
  throw new DomainError("Seules les images PNG, JPEG ou WebP sont acceptées.");
}
export async function storeImage(bytes: Uint8Array, details: { kind: "uploaded" | "generated"; alt: string; prompt?: string }, directory?: string): Promise<ImageAsset> {
  const format = imageFormat(bytes); const id = randomUUID(); const filename = `${id}.${format.ext}`;
  if (directory === undefined && isSupabaseMode()) await uploadPrivateObject(`media/${filename}`, bytes, format.mime);
  else { const root = directory ?? mediaDirectory(); await mkdir(root, { recursive: true });
    await writeFile(path.join(root, filename), bytes, { flag: "wx" }); }
  return { id, url: `/api/demo/media/${filename}`, alt: details.alt.slice(0, 250), kind: details.kind,
    reviewed: details.kind === "uploaded", sourceUrl: "", prompt: (details.prompt ?? "").slice(0, 3000) };
}
export async function readImage(filename: string, directory?: string) {
  if (!mediaName.test(filename)) throw new DomainError("Image introuvable.", 404);
  try { const bytes = directory === undefined && isSupabaseMode() ? await downloadPrivateObject(`media/${filename}`) : await readFile(path.join(directory ?? mediaDirectory(), filename)); return { bytes, mime: imageFormat(bytes).mime }; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new DomainError("Image introuvable.", 404); throw error; }
}
export async function validateLocalImages(images: ImageAsset[]) {
  for (const image of images) if (image.url.startsWith("/api/demo/media/")) await readImage(image.url.slice("/api/demo/media/".length));
}
export async function sharedImageUrl(filename: string) {
  if (!mediaName.test(filename)) throw new DomainError("Image introuvable.", 404);
  return privateObjectUrl(`media/${filename}`);
}
