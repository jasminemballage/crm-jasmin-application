import { z } from "zod";
import { channels } from "./model";

const line = z.string().trim().max(80).refine(v => !/[\u0000-\u001f]/.test(v), "Caractère de contrôle interdit.");
export const chronopostAddressDraftSchema = z.object({
  name: line, address1: line, address2: line, zipCode: z.string().trim().max(10), city: line,
  country: z.literal("FR"), contactName: line, email: z.string().trim().max(100), phone: z.string().trim().max(25)
}).strict();
export const chronopostAddressSchema = chronopostAddressDraftSchema.extend({
  name: line.min(1), address1: line.min(1), city: line.min(1), contactName: line.min(1),
  zipCode: z.string().regex(/^(?!97|98)\d{5}$/, "France métropolitaine uniquement : code postal à 5 chiffres."),
  email: z.email().max(100), phone: z.string().trim().regex(/^\+?[\d ().-]{8,25}$/, "Téléphone requis et invalide.")
    .refine(value => { const digits = value.replace(/\D/g, "").length; return digits >= 8 && digits <= 15; }, "Le téléphone doit contenir entre 8 et 15 chiffres.")
});
export const chronopostChannelSchema = z.object({
  accountNumber: z.string().trim().max(9).regex(/^\d*$/, "Numéro de compte numérique."),
  subAccount: z.string().trim().max(9).regex(/^\d*$/, "Sous-compte numérique."),
  productCode: z.string().trim().max(3).regex(/^[A-Za-z0-9]*$/),
  service: z.string().trim().max(3).regex(/^[A-Za-z0-9]*$/)
}).strict();
export const chronopostChannelsSchema = z.object({ Amazon: chronopostChannelSchema, Cdiscount: chronopostChannelSchema,
  RETIF: chronopostChannelSchema, METRO: chronopostChannelSchema, "Site Jasmin": chronopostChannelSchema }).strict();
export const chronopostSettingsInput = z.object({ enabled: z.boolean(), shipper: chronopostAddressDraftSchema,
  channels: chronopostChannelsSchema, password: z.string().min(1).max(512).optional(), clearPassword: z.boolean() }).strict();
export const chronopostLabelInput = z.object({ shipmentId: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/), recipient: chronopostAddressSchema, confirmed: z.literal(true) }).strict();
export type ChronopostAddress = z.infer<typeof chronopostAddressDraftSchema>;
export type ChronopostChannel = z.infer<typeof chronopostChannelSchema>;
export type ChronopostSettingsInput = z.infer<typeof chronopostSettingsInput>;
export type ChronopostSettings = Omit<ChronopostSettingsInput, "clearPassword" | "password" | "channels"> & { password: string; channels: Record<string, ChronopostChannel> };
export type ChronopostStatus = Omit<ChronopostSettings, "password"> & { passwordPresent: boolean; ready: boolean; verified: false };
export const chronopostDiagnosticSchema = z.object({
  stage: z.enum(["request", "response", "parse", "persist"]),
  code: z.enum(["NETWORK_FAILURE", "NETWORK_DNS_FAILURE", "NETWORK_CONNECTION_REFUSED", "NETWORK_CONNECTION_RESET", "NETWORK_TLS_FAILURE", "NETWORK_TIMEOUT", "REQUEST_ABORTED", "HTTP_ERROR", "EMPTY_RESPONSE", "RESPONSE_TOO_LARGE", "RESPONSE_READ_FAILED", "INVALID_XML", "SOAP_FAULT", "MISSING_RESULT", "INCONSISTENT_RESULT", "CARRIER_REJECTED", "INCOMPLETE_RESULT", "INVALID_PDF_ENCODING", "INVALID_PDF", "RESPONSE_PERSIST_FAILED", "PDF_PERSIST_FAILED", "RECORD_PERSIST_FAILED", "UNKNOWN_FAILURE"]),
  httpStatus: z.number().int().min(100).max(599).optional()
}).strict();
export type ChronopostDiagnostic = z.infer<typeof chronopostDiagnosticSchema>;
export type ChronopostLabelStatus = { shipmentId: string; status: "none" | "pending" | "uncertain" | "rejected" | "created";
  trackingNumber?: string; pdfUrl?: string; createdAt?: string; message?: string; reused?: boolean; diagnostic?: ChronopostDiagnostic };
export const emptyChronopostAddress = (): ChronopostAddress => ({ name: "", address1: "", address2: "", zipCode: "", city: "", country: "FR", contactName: "", email: "", phone: "" });
export const emptyChronopostChannels = () => Object.fromEntries(channels.map(channel => [channel, { accountNumber: "", subAccount: "", productCode: "", service: "" }])) as z.infer<typeof chronopostChannelsSchema>;

export type ChronopostPublicSettings = ChronopostStatus;
