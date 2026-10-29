import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { readImportFile } from "./read-file";
import { parseRows } from "./parse-rows";

describe("readImportFile (CSV)", () => {
  it("conserva ceros iniciales del SKU y puntos de miles del precio como texto", async () => {
    const csv = 'SKU,Nombre,Precio efectivo,Precio contado\n00123,Heladera,"1.234","12.345"\n007,Otra,500,600\n';
    const { rows } = await readImportFile(Buffer.from(csv), "x.csv");
    const { valid } = parseRows(rows);
    expect(valid.map((r) => r.sku)).toEqual(["00123", "007"]);
    expect(valid[0].data).toMatchObject({ cashPrice: 1234, listPrice: 12345 });
  });
  it("celdas de error de Excel no terminan como [object Object]", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("a");
    ws.addRow(["SKU", "Nombre"]);
    ws.addRow(["A1", { error: "#N/A" }]);
    const { rows } = await readImportFile(Buffer.from(await wb.xlsx.writeBuffer()), "x.xlsx");
    expect(String(rows[0].cells.name ?? "")).not.toContain("object");
  });
});
