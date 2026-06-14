import * as XLSX from 'xlsx';
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
  HeadingLevel,
  AlignmentType,
  ShadingType,
} from 'docx';

export interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => string;
}

function toRows<T>(data: T[], columns: ExportColumn<T>[]): string[][] {
  return data.map((row) => columns.map((col) => col.accessor(row)));
}

export function exportToXlsx<T>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string,
  sheetName = 'Данные'
): void {
  const headers = columns.map((c) => c.header);
  const rows = toRows(data, columns);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Ширина колонок по содержимому
  ws['!cols'] = headers.map((h, i) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map((r) => (r[i] ?? '').length)
    );
    return { wch: Math.min(maxLen + 2, 50) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export async function exportToDocx<T>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string,
  title: string
): Promise<void> {
  const headers = columns.map((c) => c.header);
  const rows = toRows(data, columns);

  const headerRow = new TableRow({
    children: headers.map(
      (h) =>
        new TableCell({
          shading: { type: ShadingType.SOLID, color: 'D6E4F0' },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: h, bold: true, size: 20 })],
            }),
          ],
        })
    ),
  });

  const dataRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: cell, size: 18 })],
                }),
              ],
            })
        ),
      })
  );

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: title,
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 120 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Дата экспорта: ${new Date().toLocaleString('ru-RU')}`,
                size: 18,
                color: '666666',
              }),
            ],
            spacing: { after: 240 },
          }),
          new Table({
            rows: [headerRow, ...dataRows],
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Всего записей: ${data.length}`,
                size: 18,
                color: '666666',
              }),
            ],
            spacing: { before: 240 },
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
