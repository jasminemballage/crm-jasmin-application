import type { ChronopostRecord } from './chronopost';
export interface ChronopostStore {
  read(shipmentId: string): Promise<ChronopostRecord | null>;
  /** Atomically commits pending before any transport call; false never authorizes sending. */
  claim(record: ChronopostRecord, attemptId: string, revision: number): Promise<boolean>;
  saveResponse(shipmentId: string, attemptId: string, bytes: Buffer): Promise<void>;
  savePdf(shipmentId: string, attemptId: string, bytes: Buffer): Promise<void>;
  finish(record: ChronopostRecord, attemptId: string): Promise<void>;
  readPdf(shipmentId: string): Promise<Buffer>;
}
export function chronopostObjectPaths(shipmentId: string, attemptId: string) {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(shipmentId) || !/^[a-f0-9-]{36}$/i.test(attemptId)) throw new Error('Invalid Chronopost object identifier');
  const base = `chronopost/${shipmentId}/${attemptId}`;
  return { response: `${base}/response.xml`, pdf: `${base}/label.pdf` };
}
