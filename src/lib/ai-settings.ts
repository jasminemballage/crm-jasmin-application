import { DomainError } from "./domain";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import path from "node:path";
import { atomicWriteFile } from "./atomic-file";
import { withSettingsFileLock } from "./settings-file-lock";
import { aiSettingsInput, type AiStatus } from "./ai-contract";
import { isSupabaseMode } from "./supabase/config";
import { readSharedSettings, writeSharedSettings } from "./supabase/settings";

const defaults = { textModel: "openai/gpt-4o-mini", imageModel: "google/gemini-2.5-flash-image",
  imageRules: "Respecter fidèlement le produit et son conditionnement. Ne pas inventer de marque, certification, texte ou accessoire. Fond propre, bonne lumière et rendu réaliste. Visuel à vérifier avant utilisation." };
export function aiConfigFile() {
  return process.env.CRM_DEMO_DATA_FILE ? path.join(path.dirname(path.resolve(process.cwd(), process.env.CRM_DEMO_DATA_FILE)), "openrouter-test.env")
    : path.join(process.cwd(), ".env.local");
}
export function readEnvValues(text: string) {
  const result: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*(OPENROUTER_[A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;
    let value = match[2];
    if (value.startsWith('"') && value.endsWith('"')) { try { value = JSON.parse(value); } catch { value = value.slice(1, -1); } }
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    else value = value.split(/\s+#/)[0];
    result[match[1]] = value;
  }
  return result;
}
async function envText(file: string) {
  try { return await readFile(file, "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return ""; throw new Error("La configuration IA ne peut pas être lue."); }
}
export async function getAiSettings(file?: string, environment: Record<string, string | undefined> = process.env): Promise<{ apiKey: string; enabled: boolean; textModel: string; imageModel: string; imageRules: string; revision?: number }> {
  if (file === undefined && isSupabaseMode(environment)) {
    const { value, revision } = await readSharedSettings("ai");
    const settings = value ? parseSharedAi(value) : { ...defaults, apiKey: "", enabled: false };
    return { ...settings, revision, enabled: environment.CRM_AI_DISABLED !== "1" && settings.enabled && !!settings.apiKey };
  }
  const values = readEnvValues(await envText(file ?? aiConfigFile()));
  const value = (key: string) => Object.hasOwn(values, key) ? values[key] : environment[key];
  const apiKey = value("OPENROUTER_API_KEY") ?? "";
  return { apiKey, enabled: environment.CRM_AI_DISABLED !== "1" && value("OPENROUTER_ENABLED") !== "false" && !!apiKey,
    textModel: value("OPENROUTER_TEXT_MODEL") || defaults.textModel, imageModel: value("OPENROUTER_IMAGE_MODEL") || defaults.imageModel,
    imageRules: value("OPENROUTER_IMAGE_RULES") ?? defaults.imageRules };
}
function parseSharedAi(value: unknown) {
  const data = aiSettingsInput.omit({ apiKey: true, clearKey: true, revision: true }).extend({ apiKey: aiSettingsInput.shape.apiKey.unwrap().or(z.literal("")) }).parse(value);
  return data;
}
export function publicAiStatus(settings: Awaited<ReturnType<typeof getAiSettings>>): AiStatus {
  return { ...("revision" in settings ? { revision: settings.revision } : {}), enabled: settings.enabled, keyPresent: !!settings.apiKey, textReady: settings.enabled && !!settings.textModel,
    imageReady: settings.enabled && !!settings.imageModel, textModel: settings.textModel, imageModel: settings.imageModel, imageRules: settings.imageRules };
}
export async function saveAiSettings(input: unknown, file?: string) {
  if (file === undefined && isSupabaseMode()) {
    const data = aiSettingsInput.parse(input);
    const before = await readSharedSettings("ai");
    const old = before.value ? parseSharedAi(before.value) : { ...defaults, apiKey: "", enabled: false };
    if (data.revision === undefined || data.revision !== before.revision) throw new DomainError("Les réglages ont changé dans une autre session. Rechargez-les avant de recommencer.", 409);
    const { clearKey, apiKey, revision, ...config } = data;
    const settings = { ...config, apiKey: clearKey ? "" : apiKey ?? old.apiKey };
    await writeSharedSettings("ai", revision, settings);
    return publicAiStatus({ ...settings, revision: revision + 1, enabled: process.env.CRM_AI_DISABLED !== "1" && settings.enabled && !!settings.apiKey });
  }
  file ??= aiConfigFile();
  const localFile = file;
  const run = async () => {
    const data = aiSettingsInput.parse(input); const old = await envText(localFile);
    const before = await getAiSettings(localFile);
    const values = { OPENROUTER_ENABLED: data.enabled ? "true" : "false",
      OPENROUTER_API_KEY: data.clearKey ? "" : data.apiKey ?? before.apiKey,
      OPENROUTER_TEXT_MODEL: data.textModel, OPENROUTER_IMAGE_MODEL: data.imageModel, OPENROUTER_IMAGE_RULES: data.imageRules };
    const keys = new Set(Object.keys(values));
    const preserved = old.split(/\r?\n/).filter(line => !keys.has(/^\s*([A-Z_]+)\s*=/.exec(line)?.[1] ?? "")).join("\n").trimEnd();
    const next = `${preserved}${preserved ? "\n" : ""}${Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join("\n")}\n`;
    await atomicWriteFile(localFile, next, 0o600);
    return publicAiStatus(await getAiSettings(localFile));
  };
  return withSettingsFileLock(localFile, run);
}
