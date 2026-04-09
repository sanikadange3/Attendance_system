import * as XLSX from 'xlsx';

/**
 * Export rows array to an Excel file download.
 * @param {object[]} rows - Array of plain objects
 * @param {string} filename - e.g. "attendance_2024-01-01.xlsx"
 * @param {string} sheetName
 */
export function exportToExcel(rows, filename = 'export.xlsx', sheetName = 'Sheet1') {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

/**
 * Parse an Excel file and return an array of objects.
 * @param {File} file
 * @returns {Promise<object[]>}
 */
export function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
