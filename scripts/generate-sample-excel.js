/**
 * Generates a sample Excel file that matches the V1 import format.
 * Run: node scripts/generate-sample-excel.js
 * Output: public/sample-program.xlsx
 */

const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const rows = [
  ["My 4-Week Program"], // optional program name in A1
  [], // blank
  ["Week", "Day", "Exercise", "Sets"],
  [1, 1, "Bench Press", "3x8"],
  [1, 1, "Squat", "4x6"],
  [1, 1, "Row", "3x10"],
  [1, 2, "Overhead Press", "3x8"],
  [1, 2, "Deadlift", "3x5"],
  [1, 2, "Pull-up", "3x8"],
  [2, 1, "Bench Press", "3x8"],
  [2, 1, "Squat", "4x6"],
  [2, 1, "Row", "3x10"],
  [2, 2, "Overhead Press", "3x8"],
  [2, 2, "Deadlift", "3x5"],
  [2, 2, "Pull-up", "3x8"],
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(rows);
XLSX.utils.book_append_sheet(wb, ws, "Program");

const outDir = path.join(__dirname, "..", "public");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "sample-program.xlsx");
XLSX.writeFile(wb, outPath);
console.log("Wrote", outPath);
