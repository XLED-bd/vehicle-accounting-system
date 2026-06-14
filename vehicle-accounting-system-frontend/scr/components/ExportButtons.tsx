import React, { useState } from 'react';
import { exportToXlsx, exportToDocx, ExportColumn } from '../utils/exportUtils';

interface ExportButtonsProps<T> {
  data: T[];
  columns: ExportColumn<T>[];
  filename: string;
  title: string;
}

export function ExportButtons<T>({
  data,
  columns,
  filename,
  title,
}: ExportButtonsProps<T>) {
  const [exporting, setExporting] = useState(false);

  const handleXlsx = () => {
    exportToXlsx(data, columns, filename);
  };

  const handleDocx = async () => {
    setExporting(true);
    try {
      await exportToDocx(data, columns, filename, title);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="export-buttons">
      <button
        className="btn-export btn-export-xlsx"
        onClick={handleXlsx}
        disabled={data.length === 0}
        title={data.length === 0 ? 'Нет данных для экспорта' : 'Экспорт в Excel'}
      >
        Excel
      </button>
      <button
        className="btn-export btn-export-docx"
        onClick={handleDocx}
        disabled={data.length === 0 || exporting}
        title={data.length === 0 ? 'Нет данных для экспорта' : 'Экспорт в Word'}
      >
        {exporting ? '...' : 'Word'}
      </button>
    </div>
  );
}
