import fs from "node:fs/promises";
import path from "node:path";
import * as XLSX from "../cloud/node_modules/xlsx/xlsx.mjs";
import { FileBlob, SpreadsheetFile } from "file:///C:/Users/MZRT/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const root = path.resolve(import.meta.dirname, "..");
const source = path.join(root, "MyFiles", "BAZA.xls");
const output = path.join(root, "tmp", "BAZA-verification.xlsx");
const previewPath = path.join(root, "tmp", "BAZA-verification.png");
await fs.mkdir(path.dirname(output), { recursive: true });

const bytes = await fs.readFile(source);
const legacy = XLSX.read(bytes, { type: "buffer", cellStyles: true });
if (legacy.SheetNames.length !== 1) throw new Error("BAZA.xls должен содержать один лист");
const sourceSheet = legacy.Sheets[legacy.SheetNames[0]];
if (sourceSheet["!ref"] !== "A1:J47") throw new Error(`Неверная область шаблона: ${sourceSheet["!ref"]}`);
await fs.writeFile(output, XLSX.write(legacy, { type: "buffer", bookType: "xlsx", cellStyles: true }));

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(output));
const sheetName = legacy.SheetNames[0];
const inspection = await workbook.inspect({ kind: "table", range: `${sheetName}!A1:J47`, include: "values,formulas", tableMaxRows: 47, tableMaxCols: 10, maxChars: 3000 });
const preview = await workbook.render({ sheetName, range: "A1:J47", scale: 1.5, format: "png" });
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
console.log(JSON.stringify({ sheetName, range: sourceSheet["!ref"], merges: sourceSheet["!merges"]?.length || 0, inspection: String(inspection).slice(0, 240), previewPath }));
