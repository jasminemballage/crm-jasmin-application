import { demoRepository } from "@/lib/repository";
import { assertLocalRequest } from "@/lib/guard";
import { DomainError } from "@/lib/domain";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { assertLocalRequest(request); return Response.json(await demoRepository.read()); }
  catch (error) { return Response.json({ error: error instanceof DomainError ? error.message : "Lecture indisponible." },
    { status: error instanceof DomainError ? error.status : 500 }); }
}
