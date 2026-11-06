import { DomainError } from './domain';
import { chronopostRecordSchema, type ChronopostRecord } from './chronopost';
import { chronopostObjectPaths, type ChronopostStore } from './chronopost-store';

type Row = { shipment_id: string; attempt_id: string; status: string; created_at: string; fingerprint: string; tracking_number: string | null; message: string | null; diagnostic: unknown; pdf_path: string | null; response_path: string | null };
export function chronopostRecordFromRow(row: Row): ChronopostRecord {
  try { return chronopostRecordSchema.parse({ shipmentId: row.shipment_id, status: row.status, createdAt: new Date(row.created_at).toISOString(), fingerprint: row.fingerprint, trackingNumber: row.tracking_number ?? undefined, message: row.message ?? undefined, diagnostic: row.diagnostic ?? undefined }); }
  catch { throw new DomainError('Historique Chronopost partagé incohérent. Vérifiez le résultat avant toute création.', 503); }
}
async function admin() { return (await import('./supabase/admin')).getSupabaseAdmin(); }
async function readRow(shipmentId: string): Promise<Row | null> {
  const db = await admin(); const { data, error } = await db.from('crm_chronopost_labels').select('*').eq('shipment_id', shipmentId).maybeSingle();
  if (error) throw new DomainError('Historique Chronopost partagé indisponible.', 503);
  return data as Row | null;
}
export const cloudChronopostStore: ChronopostStore = {
  async read(id) { const row = await readRow(id); return row ? chronopostRecordFromRow(row) : null; },
  async claim(record, attemptId, revision) {
    const db = await admin();
    const { data, error } = await db.rpc('crm_claim_chronopost', { p_shipment_id: record.shipmentId, p_fingerprint: record.fingerprint, p_attempt_id: attemptId, p_revision: revision });
    if (error) throw new DomainError('Impossible de réserver cet envoi. Les données ont pu changer ; actualisez avant de réessayer.', 409);
    const row = Array.isArray(data) ? data[0] : data;
    return !!row && row.attempt_id === attemptId && row.status === 'pending';
  },
  async saveResponse(id, attempt, bytes) { const { uploadPrivateObject } = await import('./supabase/storage'); await uploadPrivateObject(chronopostObjectPaths(id, attempt).response, bytes, 'application/xml'); },
  async savePdf(id, attempt, bytes) { const { uploadPrivateObject } = await import('./supabase/storage'); await uploadPrivateObject(chronopostObjectPaths(id, attempt).pdf, bytes, 'application/pdf'); },
  async finish(record, attemptId) {
    const db = await admin(); const paths = chronopostObjectPaths(record.shipmentId, attemptId);
    const { data, error } = await db.rpc('crm_finish_chronopost', { p_shipment_id: record.shipmentId, p_attempt_id: attemptId, p_status: record.status, p_tracking_number: record.trackingNumber ?? null, p_message: record.message ?? null, p_diagnostic: record.diagnostic ?? null, p_response_path: paths.response, p_pdf_path: record.status === 'created' ? paths.pdf : null });
    if (error || data !== true) throw new DomainError('Le résultat Chronopost ne peut pas être enregistré. Aucune nouvelle création ne doit être lancée.', 503);
  },
  async readPdf(id) {
    const row = await readRow(id);
    if (!row || row.status !== 'created' || !row.pdf_path) throw new DomainError('Le PDF existant est indisponible. Ne créez pas un nouvel envoi.', 503);
    return (await import('./supabase/storage')).downloadPrivateObject(row.pdf_path);
  }
};
export async function sharedChronopostPdfUrl(shipmentId: string) {
  const row = await readRow(shipmentId);
  if (!row || row.status !== 'created' || !row.pdf_path) throw new DomainError('Aucun PDF existant disponible pour ce colis. Ne créez pas un nouvel envoi.', 404);
  return (await import('./supabase/storage')).privateObjectUrl(row.pdf_path, `chronopost-${shipmentId}.pdf`);
}
