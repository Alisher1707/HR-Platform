import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Diagrammadagi aynan shu ranglar (globals.css --dept-success/--dept-warning/--dept-error/neytral kulrang)
const STATUS_COLORS = {
  onTime: [4, 120, 87], // --dept-success
  late: [180, 83, 9], // --dept-warning
  absent: [190, 18, 60], // --dept-error
  pending: [100, 116, 139], // --text-secondary (neytral)
};

const STATUS_LABELS = {
  onTime: 'Vaqtida keldi',
  late: 'Kech keldi',
  absent: 'Kelmagan',
  pending: 'Kutilmoqda',
};

const BAR_X = 14;
const BAR_WIDTH = 182;
const BAR_HEIGHT = 6;

/**
 * Har bir bo'lim uchun nomi + jami xodimlar soni yozib, pastida
 * Vaqtida/Kech/Kelmagan/Kutilmoqda ulushlariga mos rangli proporsional
 * chiziq (stacked bar) chizadi — diagrammadagi bilan bir xil ranglarda,
 * lekin vektor shaklida (screenshot emas, shuning uchun har doim aniq va
 * ravshan chiqadi, brauzer/render holatiga bog'liq emas).
 */
function drawDepartmentBar(doc, y, row) {
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 40);
  doc.setFont(undefined, 'bold');
  doc.text(row.department, BAR_X, y);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`${row.total} xodim`, BAR_X + BAR_WIDTH, y, { align: 'right' });

  const barY = y + 3;
  doc.setFillColor(230, 232, 238);
  doc.roundedRect(BAR_X, barY, BAR_WIDTH, BAR_HEIGHT, 1.5, 1.5, 'F');

  let cursorX = BAR_X;
  const order = ['onTime', 'late', 'absent', 'pending'];
  order.forEach((key) => {
    const value = row[key] || 0;
    if (value <= 0 || row.total <= 0) return;
    const segWidth = (value / row.total) * BAR_WIDTH;
    const [r, g, b] = STATUS_COLORS[key];
    doc.setFillColor(r, g, b);
    doc.rect(cursorX, barY, segWidth, BAR_HEIGHT, 'F');
    cursorX += segWidth;
  });

  return barY + BAR_HEIGHT + 9;
}

/**
 * Bo'limlar bo'yicha bugungi davomat diagrammasini PDF hisobot sifatida
 * yuklab olish — har bo'lim uchun rangli proporsional chiziq (diagramma
 * bilan bir xil ranglarda) va pastida to'liq raqamli jadval.
 */
export function exportDepartmentAttendanceToPdf(rows, filename) {
  const doc = new jsPDF({ orientation: 'portrait' });

  doc.setFontSize(15);
  doc.setTextColor(20, 20, 30);
  doc.text("Bo'limlar bo'yicha bugungi davomat hisoboti", 14, 17);
  doc.setFontSize(9);
  doc.setTextColor(120);
  const now = new Date();
  doc.text(
    `Sana: ${now.toLocaleDateString('ru-RU')}   Yuklab olindi: ${now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`,
    14,
    23
  );

  // Legend
  let legendX = 14;
  const legendY = 30;
  doc.setFontSize(8.5);
  Object.entries(STATUS_LABELS).forEach(([key, label]) => {
    const [r, g, b] = STATUS_COLORS[key];
    doc.setFillColor(r, g, b);
    doc.circle(legendX + 1.2, legendY - 1.2, 1.2, 'F');
    doc.setTextColor(80);
    doc.text(label, legendX + 4, legendY);
    legendX += doc.getTextWidth(label) + 12;
  });

  let y = 42;
  const pageHeight = doc.internal.pageSize.getHeight();

  rows.forEach((row) => {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }
    y = drawDepartmentBar(doc, y, row);
  });

  const tableColumns = ["Bo'lim", 'Jami', 'Vaqtida keldi', 'Kech keldi', 'Kelmagan', 'Kutilmoqda'];
  const tableBody = rows.map((row) => [
    row.department,
    row.total,
    row.onTime || 0,
    row.late || 0,
    row.absent || 0,
    row.pending || 0,
  ]);

  autoTable(doc, {
    startY: y + 4,
    head: [tableColumns],
    body: tableBody,
    styles: { fontSize: 9, cellPadding: 3, halign: 'center' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    headStyles: { fillColor: [99, 102, 241], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 250] },
  });

  doc.save(filename);
}
