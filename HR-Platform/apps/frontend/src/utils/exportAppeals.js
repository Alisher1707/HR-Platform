import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Exports the fine-appeal (tushuntirish xati) history — every appeal that's
 * ever come in via the Telegram bot, whatever its outcome — to a
 * downloadable .xlsx file. `rows` are plain objects with the column labels
 * already as keys (see AttendancePage.jsx#appealsExportRows), matching the
 * existing exportAttendanceReportToExcel convention.
 */
export function exportAppealsToExcel(rows, filename) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 14 }, { wch: 22 }, { wch: 24 }, { wch: 36 }, { wch: 24 }, { wch: 20 }, { wch: 14 }, { wch: 28 }, { wch: 18 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Arizalar');
  XLSX.writeFile(workbook, filename);
}

/** Same data, as a landscape PDF table (jsPDF has no Uzbek-server dependency — generated entirely client-side). */
export function exportAppealsToPdf(rows, filename) {
  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(14);
  doc.text('Arizalar hisoboti', 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Yuklab olindi: ${new Date().toLocaleDateString('ru-RU')}`, 14, 21);

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  autoTable(doc, {
    startY: 26,
    head: [columns],
    body: rows.map((row) => columns.map((col) => row[col])),
    styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [99, 102, 241], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    columnStyles: { 3: { cellWidth: 70 } }, // "Sababi" — the free-text reason column, needs the most room
  });

  doc.save(filename);
}
