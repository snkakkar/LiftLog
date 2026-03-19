/**
 * File reader: load CSV/XLSX safely, normalize sheet access, preserve raw cell values.
 * Uses exceljs (no known critical vulnerabilities). No parsing logic—only reads the workbook and returns rows as 2D array.
 */

import ExcelJS from "exceljs";
import { Readable } from "stream";

export interface ReadResult {
  rows: (string | number)[][];
  sheetName: string;
  fileName?: string;
}

function cellToValue(val: ExcelJS.CellValue): string | number {
  if (val == null) return "";
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  if (typeof val === "string") return val;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === "object" && "result" in val && typeof (val as { result: number }).result === "number") {
    return (val as { result: number }).result;
  }
  return String(val);
}

/**
 * Read a workbook from a buffer. Uses file extension to detect CSV vs XLSX.
 * Preserves raw values and avoids converting numbers to dates where possible.
 */
export async function readWorkbook(
  buffer: ArrayBuffer,
  fileName?: string
): Promise<ReadResult> {
  const bytes = Buffer.from(buffer);
  const isCsv =
    fileName != null &&
    (fileName.toLowerCase().endsWith(".csv") || fileName.toLowerCase().endsWith(".txt"));

  const workbook = new ExcelJS.Workbook();

  if (isCsv) {
    const stream = Readable.from(bytes);
    await workbook.csv.read(stream);
  } else {
    await workbook.xlsx.load(bytes as any);
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error("Workbook has no sheets");
  }

  const rows: (string | number)[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row, _rowNumber) => {
    const arr: (string | number)[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      arr[colNumber - 1] = cellToValue(cell.value);
    });
    rows.push(arr);
  });

  return {
    rows,
    sheetName: sheet.name,
    fileName: fileName ?? undefined,
  };
}

export interface SheetRows {
  sheetName: string;
  rows: (string | number)[][];
}

/**
 * Read all sheets from the workbook. Use when the program might be on any sheet.
 */
export async function readAllSheets(
  buffer: ArrayBuffer,
  fileName?: string
): Promise<{ sheets: SheetRows[]; fileName?: string }> {
  const bytes = Buffer.from(buffer);
  const isCsv =
    fileName != null &&
    (fileName.toLowerCase().endsWith(".csv") || fileName.toLowerCase().endsWith(".txt"));

  const workbook = new ExcelJS.Workbook();

  if (isCsv) {
    const stream = Readable.from(bytes);
    await workbook.csv.read(stream);
  } else {
    await workbook.xlsx.load(bytes as any);
  }

  const sheets: SheetRows[] = [];

  for (const sheet of workbook.worksheets) {
    const rows: (string | number)[][] = [];
    sheet.eachRow({ includeEmpty: true }, (row) => {
      const arr: (string | number)[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        arr[colNumber - 1] = cellToValue(cell.value);
      });
      rows.push(arr);
    });
    sheets.push({ sheetName: sheet.name, rows });
  }

  return {
    sheets: sheets.length > 0 ? sheets : [],
    fileName: fileName ?? undefined,
  };
}
