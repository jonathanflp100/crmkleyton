
export class ExportService {
  /**
   * Export array of objects to CSV with Brazilian Excel UTF-8 BOM
   */
  static exportToCSV(filename: string, rows: Record<string, any>[]): void {
    if (!rows || !rows.length) {
      alert('Não há dados para exportar.');
      return;
    }

    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(';'),
      ...rows.map((row) =>
        headers
          .map((fieldName) => {
            let val = row[fieldName];
            if (val === null || val === undefined) val = '';
            val = String(val).replace(/"/g, '""');
            return `"${val}"`;
          })
          .join(';')
      ),
    ].join('\r\n');

    // Add BOM for Excel Portuguese encoding
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Export JSON backup
   */
  static exportToJSON(filename: string, data: any): void {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${filename}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

}
