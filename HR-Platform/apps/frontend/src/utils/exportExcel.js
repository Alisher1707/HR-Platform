import * as XLSX from 'xlsx';

/**
 * Exports a Davomat hisoboti (attendanceService.getReport) result set to a
 * downloadable .xlsx file — always includes every column regardless of
 * which REPORT_FIELDS checkboxes are toggled on screen, since the point of
 * the download is the full underlying data.
 */
export function exportAttendanceReportToExcel(rows, filename) {
  const data = rows.map((r) => ({
    Xodim: `${r.firstName} ${r.lastName}`,
    Filial: r.branch || '-',
    "Bo'lim": r.department || '-',
    Lavozim: r.position || '-',
    'Kelgan kunlar': r.daysPresent,
    Kechikishlar: r.daysLate,
    'Erta ketishlar': r.daysEarlyLeave,
    "Qo'shimcha soatlar": r.overtimeHours,
    'Umumiy soatlar': r.totalHours,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  worksheet['!cols'] = [
    { wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 16 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Davomat hisoboti');
  XLSX.writeFile(workbook, filename);
}
