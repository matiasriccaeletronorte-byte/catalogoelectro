import ExcelJS from "exceljs";
import { Readable } from "stream";
import { ColumnKey, columnForHeader } from "./columns";
import type { RawRow } from "./parse-rows";

export const MAX_IMPORT_ROWS = 10_000;

function cellValue(value: ExcelJS.CellValue): unknown {
  if (value && typeof value === "object") {
    if (value instanceof Date) return value.toISOString();
    if ("error" in value) return "";
    if ("result" in value) return value.result;
    if ("text" in value) return value.text;
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
  }
  return value;
}

export async function readImportFile(buffer: Buffer, filename: string): Promise<{ rows: RawRow[]; columns: ColumnKey[] }> {
  const workbook = new ExcelJS.Workbook();
  if (/\.csv$/i.test(filename)) await workbook.csv.read(Readable.from(buffer), { map: (value: unknown) => value });
  else await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("El archivo no tiene hojas.");
  const columnByIndex = new Map<number, ColumnKey>();
  sheet.getRow(1).eachCell((cell, index) => {
    const key = columnForHeader(String(cellValue(cell.value) ?? ""));
    if (key) columnByIndex.set(index, key);
  });
  if (![...columnByIndex.values()].includes("sku")) throw new Error("No se encontró la columna SKU en la primera fila.");
  if (sheet.rowCount - 1 > MAX_IMPORT_ROWS) throw new Error(`El archivo supera las ${MAX_IMPORT_ROWS} filas.`);
  const rows: RawRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const cells: RawRow["cells"] = {};
    columnByIndex.forEach((key, index) => { cells[key] = cellValue(row.getCell(index).value); });
    if (Object.values(cells).some((v) => v !== null && v !== undefined && String(v).trim() !== "")) rows.push({ rowNumber, cells });
  });
  return { rows, columns: [...new Set(columnByIndex.values())] };
}
