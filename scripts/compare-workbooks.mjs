/**
 * One-off script to compare two Min-Max Excel files.
 * Run: node scripts/compare-workbooks.mjs
 */

import * as fs from "fs";
import * as XLSX from "xlsx";

const paths = [
  "/Users/shachi.kakkar/Downloads/Min-Max_Program_4x.xlsx",
  "/Users/shachi.kakkar/Downloads/Min-Max_Program_4x (1).xlsx",
];

function readWorkbook(buffer, fileName) {
  const workbook = XLSX.read(new Uint8Array(buffer), {
    type: "array",
    raw: true,
    cellDates: false,
    cellNF: false,
  });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("No sheet");
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
    blankrows: true,
  });
  return { rows: Array.isArray(rows) ? rows : [], sheetName: workbook.SheetNames[0] };
}

function describeRow(row, maxCols = 20) {
  const parts = [];
  for (let c = 0; c < maxCols; c++) {
    const v = row[c];
    if (v === undefined && c >= row.length) break;
    const type = v === null ? "null" : typeof v;
    const preview = v == null ? "" : String(v).slice(0, 25);
    parts.push(`[${c}]${type}:${preview}`);
  }
  return parts.join(" | ");
}

for (const filePath of paths) {
  const name = filePath.split("/").pop();
  console.log("\n" + "=".repeat(80));
  console.log("FILE:", name);
  console.log("=".repeat(80));

  if (!fs.existsSync(filePath)) {
    console.log("  (file not found)");
    continue;
  }

  const buf = fs.readFileSync(filePath);
  const { rows, sheetName } = readWorkbook(buf, name);
  console.log("Sheet:", sheetName, "| Rows:", rows.length);
  console.log("");

  for (let r = 0; r < Math.min(25, rows.length); r++) {
    const row = rows[r] || [];
    console.log(`Row ${r}: ${describeRow(row)}`);
  }
  console.log("");
}
