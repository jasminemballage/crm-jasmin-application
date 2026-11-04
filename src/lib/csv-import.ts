import { productInput, type CatalogImportRow, type StockImportRow } from "./model";
import type { ImportIssue } from "./import-plan";

export const IMPORT_LIMITS = { bytes: 1_048_576, rows: 1000, columns: 40, cell: 2000 };
type CsvRecord = { cells: string[]; line: number };
export type CsvResult = {
  kind: "products" | "stock"; catalogRows: CatalogImportRow[]; stockRows: StockImportRow[];
  sourceLines: number[]; errors: ImportIssue[]; warnings: string[]; totalRows: number;
};
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function decodeImportFile(bytes: Uint8Array) {
  if (bytes.length > IMPORT_LIMITS.bytes) throw new Error("Le fichier dépasse 1 Mo. Limitez-le à 1 000 lignes par import.");
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le", { fatal: true }).decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be", { fatal: true }).decode(bytes);
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return new TextDecoder("windows-1252").decode(bytes); }
}

export function readCsv(input: string): CsvRecord[] {
  if (new TextEncoder().encode(input).length > IMPORT_LIMITS.bytes * 3) throw new Error("Fichier trop volumineux.");
  if (input.includes("\0")) throw new Error("Fichier binaire non pris en charge. Enregistrez votre tableur au format CSV.");
  let text = input.replace(/^\uFEFF/, "");
  let line = 1;
  let delimiter = ";";
  const directive = /^sep=([;,\t])\r?\n/i.exec(text);
  if (directive) { delimiter = directive[1]; text = text.slice(directive[0].length); line = 2; }
  else {
    let quoted = false;
    const counts: Record<string, number> = { ";": 0, ",": 0, "\t": 0 };
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') { if (quoted && text[i + 1] === '"') i++; else quoted = !quoted; }
      if (!quoted && /[\r\n]/.test(c)) break;
      if (!quoted && c in counts) counts[c]++;
    }
    delimiter = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  }
  const records: CsvRecord[] = [];
  let cells: string[] = [], cell = "", quoted = false, closed = false, startLine = line;
  const finishCell = () => {
    if (cell.length > IMPORT_LIMITS.cell) throw new Error(`Ligne ${startLine} : une cellule dépasse ${IMPORT_LIMITS.cell} caractères.`);
    cells.push(cell); cell = ""; closed = false;
    if (cells.length > IMPORT_LIMITS.columns) throw new Error("Le fichier dépasse 40 colonnes.");
  };
  const finishRow = () => {
    finishCell();
    if (cells.some(v => v.trim() !== "")) records.push({ cells, line: startLine });
    cells = [];
    if (records.length > IMPORT_LIMITS.rows + 1) throw new Error("Le fichier dépasse 1 000 lignes de données.");
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } }
      else if (c === "\r" || c === "\n") { if (c === "\r" && text[i + 1] === "\n") i++; cell += "\n"; line++; }
      else cell += c;
    } else if (c === delimiter) finishCell();
    else if (c === "\r" || c === "\n") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      finishRow(); line++; startLine = line;
    } else if (c === '"' && !closed && cell === "") quoted = true;
    else if (c === '"' || (closed && c.trim() !== "")) throw new Error(`Ligne ${line} : guillemets CSV mal placés.`);
    else if (!closed) cell += c;
  }
  if (quoted) throw new Error(`Ligne ${startLine} : guillemet de fermeture manquant.`);
  if (cell !== "" || cells.length || closed) finishRow();
  return records;
}

const aliases: Record<string, string[]> = {
  sku: ["sku", "reference", "referencesku"], name: ["nom", "produit", "nomduproduit", "produitfictif"],
  category: ["categorie"], unitsPerPack: ["piecesparpaquet", "piecespaquet"], packsPerCarton: ["paquetsparcarton", "paquetscarton"],
  priceCents: ["prixht", "prixhtpaquet", "prixhteurpaquet", "prixhtdupaquet"],
  safetyPacks: ["securitepaquets", "stocksecuritepaquets", "stockdesecurite"], weightGrams: ["poidsgrammes", "poidsdupaquetg", "poidspaquetg"],
  stockPacks: ["stockpaquets", "stockphysiquepaquets", "physiquepaquets"], stockCartons: ["stockcartons", "stockphysiquecartons"]
};
const aliasLookup = new Map(Object.entries(aliases).flatMap(([key, values]) => values.map(v => [v, key])));
function integer(value: string) {
  if (!/^\d+$/.test(value)) throw new Error("Entier positif ou nul attendu, sans formule ni décimale.");
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n > 1_000_000) throw new Error("Quantité supérieure à 1 000 000.");
  return n;
}
function cents(value: string) {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) throw new Error("Prix en euros attendu, avec deux décimales au maximum (ex. 4,25).");
  const [whole, decimal = ""] = value.replace(",", ".").split(".");
  const result = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result > 1_000_000) throw new Error("Prix supérieur à 10 000 €.");
  return result;
}
export function parseImportCsv(text: string, kind: "products" | "stock"): CsvResult {
  const result: CsvResult = { kind, catalogRows: [], stockRows: [], sourceLines: [], errors: [], warnings: [], totalRows: 0 };
  let records: CsvRecord[];
  try { records = readCsv(text); }
  catch (error) { result.errors.push({ line: 1, sku: "", message: error instanceof Error ? error.message : "CSV invalide." }); return result; }
  if (records.length < 2) { result.errors.push({ line: 1, sku: "", message: "Ajoutez un en-tête et au moins une ligne de données." }); return result; }
  const header = records[0].cells;
  const keys = header.map(h => aliasLookup.get(normalize(h)) ?? "");
  const relevant = kind === "products" ? ["sku", "name", "category", "unitsPerPack", "packsPerCarton", "priceCents", "safetyPacks", "weightGrams"] : ["sku", "stockPacks", "stockCartons"];
  for (const key of relevant) if (keys.filter(k => k === key).length > 1)
    result.errors.push({ line: records[0].line, sku: "", message: `Colonne répétée ou ambiguë : ${header[keys.indexOf(key)]}.` });
  if (!keys.includes("sku")) result.errors.push({ line: records[0].line, sku: "", message: "La colonne SKU est obligatoire." });
  if (kind === "stock" && !keys.includes("stockPacks") && !keys.includes("stockCartons"))
    result.errors.push({ line: records[0].line, sku: "", message: "Ajoutez une colonne StockPaquets ou StockCartons." });
  const ignored = header.filter((_, i) => !relevant.includes(keys[i]));
  if (ignored.length) result.warnings.push(`Colonnes non utilisées : ${ignored.map(v => v.slice(0, 60)).join(", ")}.`);
  if (kind === "products" && (keys.includes("stockPacks") || keys.includes("stockCartons")))
    result.warnings.push("Les colonnes de stock ne sont pas importées ici. Utilisez l’import de stock pour enregistrer un inventaire.");
  result.totalRows = records.length - 1;
  if (result.errors.length) return result;
  for (const record of records.slice(1)) {
    let sku = "";
    try {
      if (record.cells.length !== header.length) throw new Error(`Nombre de cellules incorrect : ${record.cells.length} au lieu de ${header.length}.`);
      const raw: Record<string, string> = {};
      keys.forEach((key, i) => { if (relevant.includes(key)) raw[key] = record.cells[i].trim(); });
      sku = raw.sku ?? "";
      const validSku = productInput.shape.sku.safeParse(sku);
      if (!validSku.success) throw new Error("SKU invalide : 2 à 40 lettres, chiffres, tirets ou points.");
      sku = validSku.data.toUpperCase();
      if (kind === "stock") {
        const packs = raw.stockPacks ?? "", cartons = raw.stockCartons ?? "";
        if ((packs !== "") === (cartons !== "")) throw new Error("Renseignez soit StockPaquets, soit StockCartons, une seule des deux valeurs par ligne.");
        result.stockRows.push({ sku, quantity: integer(packs !== "" ? packs : cartons), unit: packs !== "" ? "pack" : "carton" });
      } else {
        const row: CatalogImportRow = { sku };
        if (raw.name) row.name = raw.name;
        if (raw.category) {
          const categories = productInput.shape.category.options;
          const category = categories.find(c => normalize(c) === normalize(raw.category));
          if (!category) throw new Error("Catégorie inconnue : Gobelets, Barquettes, Sacs, Couverts ou Accessoires attendus.");
          row.category = category;
        }
        for (const key of ["unitsPerPack", "packsPerCarton", "safetyPacks", "weightGrams"] as const)
          if (raw[key]) row[key] = integer(raw[key]);
        if (raw.priceCents) row.priceCents = cents(raw.priceCents);
        result.catalogRows.push(row);
      }
      result.sourceLines.push(record.line);
    } catch (error) { result.errors.push({ line: record.line, sku, message: error instanceof Error ? error.message : "Ligne invalide." }); }
  }
  return result;
}
