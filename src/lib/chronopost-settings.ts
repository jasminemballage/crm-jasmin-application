import { readFile } from "node:fs/promises";
import { z } from "zod";
import path from "node:path";
import { atomicWriteFile } from "./atomic-file";
import { withSettingsFileLock } from "./settings-file-lock";
import { DomainError } from "./domain";
import { isSupabaseMode } from "./supabase/config";
import { readSharedSettings, writeSharedSettings } from "./supabase/settings";
import { chronopostAddressSchema, chronopostSettingsInput, emptyChronopostAddress, emptyChronopostChannels, type ChronopostSettings, type ChronopostStatus } from "./chronopost-contract";

export function chronopostConfigFile() {
  return process.env.CRM_DEMO_DATA_FILE ? path.join(path.dirname(path.resolve(process.cwd(), process.env.CRM_DEMO_DATA_FILE)), "chronopost-test.env") : path.join(process.cwd(), ".env.local");
}
async function envText(file: string) {
  try { return await readFile(file, "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return ""; throw new DomainError("La configuration Chronopost ne peut pas être lue.", 503); }
}
function envValues(text: string) {
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*(CHRONOPOST_CONFIG|CHRONOPOST_PASSWORD)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;
    try { values[match[1]] = JSON.parse(match[2]); } catch { values[match[1]] = match[2].replace(/^'|'$/g, ""); }
  }
  return values;
}
export async function getChronopostSettings(file?: string, environment: Record<string, string | undefined> = process.env): Promise<ChronopostSettings> {
  if (file === undefined && isSupabaseMode(environment)) {
    const { value, revision } = await readSharedSettings("chronopost");
    if (!value) return { revision, enabled: false, shipper: emptyChronopostAddress(), channels: emptyChronopostChannels(), password: "" };
    return { ...parseSharedChronopost(value), revision };
  }
  const values = envValues(await envText(file ?? chronopostConfigFile()));
  const value = (key: string) => Object.hasOwn(values, key) ? values[key] : environment[key];
  const raw = value("CHRONOPOST_CONFIG");
  let config;
  try { config = raw ? chronopostSettingsInput.omit({ password: true, clearPassword: true }).parse(JSON.parse(raw)) : { enabled: false, shipper: emptyChronopostAddress(), channels: emptyChronopostChannels() }; }
  catch { throw new DomainError("La configuration Chronopost est invalide. Corrigez-la avant toute génération.", 503); }
  return { ...config, password: value("CHRONOPOST_PASSWORD") ?? "" };
}
function parseSharedChronopost(value: unknown): ChronopostSettings {
  const data = chronopostSettingsInput.omit({ clearPassword: true, revision: true }).extend({ password: z.string().max(512) }).parse(value);
  return { ...data, password: data.password ?? "" };
}
export function publicChronopostStatus(settings: ChronopostSettings): ChronopostStatus {
  const { password, ...config } = settings;
  const complete = Object.values(settings.channels).some(c => Number(c.accountNumber) > 0 && c.subAccount !== "" && !!c.productCode && !!c.service);
  return { ...config, passwordPresent: !!password, ready: settings.enabled && !!password && complete && chronopostAddressSchema.safeParse(settings.shipper).success, verified: false };
}
export async function saveChronopostSettings(input: unknown, file?: string) {
  if (file === undefined && isSupabaseMode()) {
    const data = chronopostSettingsInput.parse(input);
    const before = await readSharedSettings("chronopost");
    const previous = before.value ? parseSharedChronopost(before.value) : null;
    if (data.revision === undefined || data.revision !== before.revision) throw new DomainError("Les réglages ont changé dans une autre session. Rechargez-les avant de recommencer.", 409);
    const { password, clearPassword, revision, ...config } = data;
    const settings = { ...config, password: clearPassword ? "" : password ?? previous?.password ?? "" };
    await writeSharedSettings("chronopost", revision, settings);
    return publicChronopostStatus({ ...settings, revision: revision + 1 });
  }
  file ??= chronopostConfigFile();
  const localFile = file;
  const run = async () => {
    const data = chronopostSettingsInput.parse(input); const old = await envText(localFile); const before = await getChronopostSettings(localFile);
    const { password, clearPassword, revision: _revision, ...config } = data;
    const values = { CHRONOPOST_CONFIG: JSON.stringify(config), CHRONOPOST_PASSWORD: clearPassword ? "" : password ?? before.password };
    const keys = new Set(Object.keys(values));
    const preserved = old.split(/\r?\n/).filter(line => !keys.has(/^\s*([A-Z_]+)\s*=/.exec(line)?.[1] ?? "")).join("\n").trimEnd();
    await atomicWriteFile(localFile, `${preserved}${preserved ? "\n" : ""}${Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join("\n")}\n`, 0o600);
    return publicChronopostStatus(await getChronopostSettings(localFile));
  };
  return withSettingsFileLock(localFile, run);
}
