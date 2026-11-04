import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { z } from "zod";
import { atomicWriteFile, renameWithRetry } from "./atomic-file";
import { DomainError } from "./domain";
import type { Order, Shipment, State } from "./model";
import { chronopostAddressSchema, chronopostLabelInput, chronopostDiagnosticSchema, type ChronopostDiagnostic, type ChronopostAddress, type ChronopostSettings, type ChronopostLabelStatus } from "./chronopost-contract";

export const CHRONOPOST_ENDPOINT = "https://ws.chronopost.fr/shipping-cxf/ShippingServiceWS";
const uncertainMessage = "Issue incertaine : Chronopost peut avoir créé l’étiquette. Vérifiez l’envoi dans votre espace Chronopost ou auprès de son support avant toute autre création. Le CRM bloque la régénération pour éviter une double étiquette.";
const recordSchema = z.object({ shipmentId: z.string(), status: z.enum(["pending", "uncertain", "rejected", "created"]), createdAt: z.iso.datetime(),
  trackingNumber: z.string().optional(), message: z.string().optional(), fingerprint: z.string(), diagnostic: chronopostDiagnosticSchema.optional() });
type Record = z.infer<typeof recordSchema>;
class CarrierRejected extends DomainError {}
class CarrierFailure extends Error {
  constructor(readonly code: ChronopostDiagnostic["code"]) { super(code); }
}
const maxResponseBytes = 8 * 1024 * 1024;
function networkCode(error: unknown): ChronopostDiagnostic["code"] {
  if (!(error instanceof Error)) return "NETWORK_FAILURE";
  if (error.name === "TimeoutError") return "NETWORK_TIMEOUT";
  if (error.name === "AbortError") return "REQUEST_ABORTED";
  const cause = error.cause as { code?: unknown } | undefined;
  const code = cause?.code ?? (error as NodeJS.ErrnoException).code;
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "NETWORK_DNS_FAILURE";
  if (code === "ECONNREFUSED") return "NETWORK_CONNECTION_REFUSED";
  if (code === "ECONNRESET" || code === "UND_ERR_SOCKET") return "NETWORK_CONNECTION_RESET";
  if (["ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT"].includes(String(code))) return "NETWORK_TIMEOUT";
  if (["CERT_HAS_EXPIRED", "DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "ERR_TLS_CERT_ALTNAME_INVALID", "EPROTO"].includes(String(code))) return "NETWORK_TLS_FAILURE";
  return "NETWORK_FAILURE";
}
export function chronopostRoot() {
  const dataFile = process.env.CRM_DEMO_DATA_FILE;
  return dataFile ? path.join(path.dirname(path.resolve(process.cwd(), dataFile)), `chronopost-${path.basename(dataFile, ".json")}`) : path.join(process.cwd(), ".local", "chronopost");
}
function files(shipmentId: string, root: string) {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(shipmentId)) throw new DomainError("Identifiant de colis invalide.");
  return { record: path.join(root, `${shipmentId}.json`), pdf: path.join(root, `${shipmentId}.pdf`), response: path.join(root, `${shipmentId}.response.xml`), lock: path.join(root, `${shipmentId}.lock`) };
}
async function loadRecord(shipmentId: string, root: string): Promise<Record | null> {
  try {
    const record = recordSchema.parse(JSON.parse(await readFile(files(shipmentId, root).record, "utf8")));
    if (record.shipmentId !== shipmentId || (record.status === "created" && !record.trackingNumber)) throw new Error("Incoherent label");
    return record;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new DomainError("L’historique Chronopost de ce colis est illisible. Il est conservé : vérifiez l’envoi auprès de Chronopost avant toute création.", 503);
  }
}
function publicLabel(record: Record): ChronopostLabelStatus {
  return { shipmentId: record.shipmentId, status: record.status, createdAt: record.createdAt,
    ...(record.status === "created" ? { trackingNumber: record.trackingNumber, pdfUrl: `/api/demo/chronopost/labels/${encodeURIComponent(record.shipmentId)}/pdf` } : {}),
    ...(record.message ? { message: record.message } : {}),
    ...(record.diagnostic ? { diagnostic: record.diagnostic } : {}) };
}
export async function readChronopostLabel(shipmentId: string, root = chronopostRoot()): Promise<ChronopostLabelStatus> {
  const record = await loadRecord(shipmentId, root);
  return record ? publicLabel(record) : { shipmentId, status: "none" };
}
export async function readChronopostPdf(shipmentId: string, root = chronopostRoot()) {
  const record = await loadRecord(shipmentId, root);
  if (record?.status !== "created") throw new DomainError("Aucune étiquette PDF disponible pour ce colis.", 404);
  try { const pdf = await readFile(files(shipmentId, root).pdf); validatePdf(pdf); return pdf; }
  catch { throw new DomainError("Le PDF local est indisponible. Récupérez l’étiquette existante auprès de Chronopost ; ne créez pas un nouvel envoi.", 503); }
}
const escapeXml = (value: string | number) => String(value).replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
const element = (name: string, value: string | number) => {
  if (typeof value === "number" && !Number.isFinite(value)) throw new DomainError("Une valeur numérique de l’envoi est invalide. Aucun appel Chronopost n’a été effectué.");
  return `<${name}>${escapeXml(value)}</${name}>`;
};
function addressXml(prefix: "shipper" | "customer" | "recipient", address: ChronopostAddress) {
  const entries: [string, string | number][] = [["Adress1", address.address1], ["Adress2", address.address2], ["City", address.city]];
  if (prefix !== "recipient") entries.push(["Civility", "E"]);
  entries.push(["ContactName", address.contactName], ["Country", address.country], ["CountryName", "France"], ["Email", address.email], ["Name", address.name], ["Phone", address.phone], ["PreAlert", 0], ["ZipCode", address.zipCode]);
  return `<${prefix}Value>${entries.map(([key, value]) => element(`${prefix}${key}`, value)).join("")}</${prefix}Value>`;
}
/** Fields and sequence follow the live official ShippingServiceWS WSDL shippingV7 types. No pickup/ESD request is sent. */
export function buildChronopostSoap(shipment: Shipment, order: Order, recipient: ChronopostAddress, config: ChronopostSettings, date = new Date()) {
  const channel = config.channels[order.channel];
  // French formatted hours contain a suffix ("20 h"); only the numeric hour part belongs in xs:int.
  const hour = Number(new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "numeric", hourCycle: "h23" }).formatToParts(date).find(part => part.type === "hour")?.value);
  const header = `<headerValue>${element("accountNumber", Number(channel.accountNumber))}${element("subAccount", Number(channel.subAccount))}</headerValue>`;
  const refs = `<refValue>${element("recipientRef", order.externalId.replace(/[\u0000-\u001f]/g, " ").slice(0, 35))}${element("shipperRef", shipment.id.slice(0, 35))}</refValue>`;
  const skybill = `<skybillValue>${element("evtCode", "DC")}${element("objectType", "MAR")}${element("productCode", channel.productCode)}${element("service", channel.service)}${element("shipDate", date.toISOString())}${element("shipHour", hour)}${element("weight", shipment.weightGrams / 1000)}${element("weightUnit", "KGM")}${element("height", shipment.heightCm)}${element("length", shipment.lengthCm)}${element("width", shipment.widthCm)}</skybillValue>`;
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:chr="http://cxf.shipping.soap.chronopost.fr/"><soap:Body><chr:shippingV7>${header}${addressXml("shipper", config.shipper)}${addressXml("customer", config.shipper)}${addressXml("recipient", recipient)}${refs}${skybill}<skybillParamsValue><mode>PDF</mode><withReservation>0</withReservation></skybillParamsValue>${element("password", config.password)}<modeRetour>1</modeRetour></chr:shippingV7></soap:Body></soap:Envelope>`;
}
function validatePdf(pdf: Buffer) {
  if (pdf.length < 12 || pdf.length > 5 * 1024 * 1024 || pdf.subarray(0, 5).toString("ascii") !== "%PDF-" || !pdf.subarray(-1024).includes(Buffer.from("%%EOF"))) throw new CarrierFailure("INVALID_PDF");
}
export function parseChronopostResponse(xml: string): { trackingNumber: string; pdf: Buffer } {
  if (xml.length > 8 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new CarrierFailure("INVALID_XML");
  const parsed = new XMLParser({ removeNSPrefix: true, ignoreAttributes: true, parseTagValue: false, trimValues: true }).parse(xml);
  const body = parsed?.Envelope?.Body;
  if (!body || body.Fault) throw new CarrierFailure("SOAP_FAULT");
  const result = body.shippingV7Response?.return;
  if (!result || typeof result.errorCode !== "string" || !/^-?\d+$/.test(result.errorCode)) throw new CarrierFailure("MISSING_RESULT");
  const code = Number(result.errorCode);
  if (code !== 0) {
    if (result.skybillNumber || result.pdfEtiquette || result.skybill) throw new CarrierFailure("INCONSISTENT_RESULT");
    throw new CarrierRejected(`Chronopost a refusé la création (code ${code}). Vérifiez le contrat, le service et l’adresse avant de réessayer.`, 422);
  }
  const trackingNumber = result.skybillNumber;
  const base64 = result.pdfEtiquette || result.skybill;
  if (typeof trackingNumber !== "string" || !/^[A-Z0-9]{8,30}$/.test(trackingNumber) || typeof base64 !== "string") throw new CarrierFailure("INCOMPLETE_RESULT");
  const compact = base64.replace(/\s/g, "");
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(compact)) throw new CarrierFailure("INVALID_PDF_ENCODING");
  const pdf = Buffer.from(compact, "base64"); validatePdf(pdf);
  return { trackingNumber, pdf };
}
async function saveRawResponse(file: string, bytes: Buffer) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, bytes, { flag: "wx", mode: 0o600 }); await renameWithRetry(temporary, file); }
  finally { await unlink(temporary).catch(() => {}); }
}
async function responseText(response: Response): Promise<{ bytes: Buffer; truncated: boolean; readFailed?: boolean }> {
  const reader = response.body?.getReader(); if (!reader) return { bytes: Buffer.alloc(0), truncated: false };
  let size = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      const remaining = maxResponseBytes - size;
      if (value.length > remaining) {
        chunks.push(value.subarray(0, remaining));
        await reader.cancel().catch(() => {});
        return { bytes: Buffer.concat(chunks), truncated: true };
      }
      chunks.push(value); size += value.length;
    }
  } catch { return { bytes: Buffer.concat(chunks), truncated: false, readFailed: true }; }
  return { bytes: Buffer.concat(chunks), truncated: false };
}

export async function createChronopostLabel(input: unknown, state: State, config: ChronopostSettings,
  options: { root?: string; requestFetch?: typeof fetch; signal?: AbortSignal } = {}): Promise<ChronopostLabelStatus> {
  const data = chronopostLabelInput.parse(input); const root = options.root ?? chronopostRoot();
  const shipment = state.shipments.find(s => s.id === data.shipmentId);
  if (!shipment) throw new DomainError("Colis introuvable.", 404);
  const order = state.orders.find(o => o.id === shipment.orderId);
  if (!order) throw new DomainError("Commande du colis introuvable.", 404);
  const cached = await loadRecord(shipment.id, root);
  if (cached?.status === "created") { await readChronopostPdf(shipment.id, root); return { ...publicLabel(cached), reused: true }; }
  const paths = files(shipment.id, root); await mkdir(root, { recursive: true });
  let lock;
  try { lock = await open(paths.lock, "wx", 0o600); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new DomainError("Une tentative Chronopost est déjà en cours ou a été interrompue. Vérifiez son résultat avant de recommencer.", 409); throw error; }
  try {
    const existing = await loadRecord(shipment.id, root);
    if (existing?.status === "created") { await readChronopostPdf(shipment.id, root); return { ...publicLabel(existing), reused: true }; }
    if (existing && ["pending", "uncertain"].includes(existing.status)) throw new DomainError(uncertainMessage, 409);
    if (shipment.status !== "prepared") throw new DomainError("La création exige un colis préparé et non remis au transporteur.", 409);
    if (["cancelled", "shipped"].includes(order.status)) throw new DomainError("La commande de ce colis est close.", 409);
    const channel = config.channels[order.channel];
    if (!config.enabled || !config.password || !chronopostAddressSchema.safeParse(config.shipper).success || !channel || !/^\d{1,9}$/.test(channel.accountNumber) || !Number(channel.accountNumber) || !/^\d{1,9}$/.test(channel.subAccount) || !/^[A-Za-z0-9]{1,3}$/.test(channel.productCode) || !/^[A-Za-z0-9]{1,3}$/.test(channel.service))
      throw new DomainError("Configurez Chronopost : mot de passe Web Services, expéditeur et compte/sous-compte/produit/service du canal sont requis.", 503);
    if (["0", "00", "86", "49", "5E", "4P"].includes(channel.productCode.toUpperCase())) throw new DomainError("Les services en point relais ne sont pas pris en charge. Configurez un service domicile adapté à votre contrat.", 422);
    if (order.country !== "FR") throw new DomainError("Ce connecteur initial prend uniquement en charge les commandes en France métropolitaine à domicile.", 422);
    const soap = buildChronopostSoap(shipment, order, data.recipient, config);
    const fingerprint = createHash("sha256").update(JSON.stringify({ shipment, recipient: data.recipient, channel })).digest("hex");
    const record: Record = { shipmentId: shipment.id, status: "pending", createdAt: new Date().toISOString(), fingerprint, message: uncertainMessage };
    options.signal?.throwIfAborted();
    // This durable marker MUST exist before the carrier can create anything. A crash blocks retries.
    await atomicWriteFile(paths.record, JSON.stringify(record), 0o600);
    let stage: ChronopostDiagnostic["stage"] = "request";
    let persistCode: ChronopostDiagnostic["code"] = "RESPONSE_PERSIST_FAILED";
    let httpStatus: number | undefined;
    try {
      const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000);
      const response = await (options.requestFetch ?? fetch)(CHRONOPOST_ENDPOINT, { method: "POST", headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: '""' }, body: soap, signal, redirect: "error" });
      httpStatus = response.status;
      stage = "response";
      const raw = await responseText(response);
      // Keep only the bounded carrier response, never the authenticated SOAP request.
      stage = "persist";
      await saveRawResponse(paths.response, raw.bytes);
      stage = "response";
      if (raw.truncated) throw new CarrierFailure("RESPONSE_TOO_LARGE");
      if (raw.readFailed) throw new CarrierFailure("RESPONSE_READ_FAILED");
      if (!response.ok) throw new CarrierFailure("HTTP_ERROR");
      if (!raw.bytes.length) throw new CarrierFailure("EMPTY_RESPONSE");
      stage = "parse";
      const result = parseChronopostResponse(raw.bytes.toString("utf8"));
      stage = "persist"; persistCode = "PDF_PERSIST_FAILED";
      const temp = `${paths.pdf}.tmp`;
      try { await writeFile(temp, result.pdf, { mode: 0o600 }); await rename(temp, paths.pdf); } finally { await unlink(temp).catch(() => {}); }
      const created: Record = { ...record, status: "created", trackingNumber: result.trackingNumber, message: undefined };
      persistCode = "RECORD_PERSIST_FAILED";
      await atomicWriteFile(paths.record, JSON.stringify(created), 0o600);
      return { ...publicLabel(created), reused: false };
    } catch (error) {
      const rejected = error instanceof CarrierRejected;
      const message = rejected ? error.message : uncertainMessage;
      const code = rejected ? "CARRIER_REJECTED" : error instanceof CarrierFailure ? error.code : stage === "request" ? networkCode(error) : stage === "persist" ? persistCode : "UNKNOWN_FAILURE";
      const diagnostic: ChronopostDiagnostic = { stage, code, ...(httpStatus ? { httpStatus } : {}) };
      // Even if this final write fails, the earlier pending marker still forbids a duplicate.
      await atomicWriteFile(paths.record, JSON.stringify({ ...record, status: rejected ? "rejected" : "uncertain", message, diagnostic }), 0o600).catch(() => {});
      throw rejected ? error : new DomainError(message, 409);
    }
  } finally { await lock.close(); await unlink(paths.lock).catch(() => {}); }
}
