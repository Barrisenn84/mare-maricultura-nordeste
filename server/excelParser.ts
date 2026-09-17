import * as XLSX from 'xlsx';

export interface ParsedSpreadsheet {
  headers: string[];
  rows: (string | number)[][];
  totalRows: number;
}

/**
 * Parses Brazilian formatted currency/numbers into standard float:
 * "12.000,50" -> 12000.50
 * "1.500" -> 1500
 * "R$ 3.500,00" -> 3500
 * "1500.50" -> 1500.50
 */
export function parseBrazilianNumber(val: any): number {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : 0;
  }
  if (!val) return 0;

  let str = String(val).trim();
  // Remove currency symbol and whitespace
  str = str.replace(/R\$\s?/gi, '').replace(/\s/g, '');

  if (!str) return 0;

  // If contains both '.' and ',', standard Brazilian 1.234,56
  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    // Only comma: 1234,56
    str = str.replace(',', '.');
  } else if (str.includes('.')) {
    // Only dot: e.g. "1.500", "12.000", "1.500.000"
    // In Brazilian standard, dot followed by 3 digits is a thousands separator!
    if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
      str = str.replace(/\./g, '');
    }
  }

  const num = parseFloat(str);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Parses date string in DD/MM/AAAA or ISO into YYYY-MM-DD
 */
export function parseBrazilianDate(val: any, fallbackDate: string = new Date().toISOString().split('T')[0]): string {
  if (!val) return fallbackDate;
  const str = String(val).trim();

  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      let year = parts[2];
      if (year.length === 2) year = `20${year}`;
      return `${year}-${month}-${day}`;
    }
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }

  return fallbackDate;
}

/**
 * RFC 4180 compliant CSV parser with quote and semicolon/comma support
 */
export function parseCSVText(csvText: string): ParsedSpreadsheet {
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      currentLine += char;
      if (inQuotes && nextChar === '"') {
        currentLine += nextChar;
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      if (currentLine.trim().length > 0) {
        lines.push(currentLine);
      }
      currentLine = '';
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim().length > 0) {
    lines.push(currentLine);
  }

  if (lines.length === 0) {
    return { headers: [], rows: [], totalRows: 0 };
  }

  // Detect delimiter in first line (; or , or \t)
  const firstLine = lines[0];
  let delimiter = ';';
  const semiCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  if (tabCount > semiCount && tabCount > commaCount) delimiter = '\t';
  else if (commaCount > semiCount) delimiter = ',';

  const cleanField = (s: string): string => {
    let trimmed = s.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
      trimmed = trimmed.substring(1, trimmed.length - 1).replace(/""/g, '"').trim();
    }
    return trimmed;
  };

  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let field = '';
    let inQ = false;

    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      const next = line[i + 1];

      if (c === '"') {
        if (inQ && next === '"') {
          field += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (c === delimiter && !inQ) {
        fields.push(cleanField(field));
        field = '';
      } else {
        field += c;
      }
    }
    fields.push(cleanField(field));
    return fields;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);

  return {
    headers,
    rows,
    totalRows: rows.length,
  };
}

/**
 * True XLSX/XLS binary parser using SheetJS (xlsx)
 */
export function parseXLSXBuffer(buffer: Buffer): ParsedSpreadsheet {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return { headers: [], rows: [], totalRows: 0 };
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (!data || data.length === 0) {
    return { headers: [], rows: [], totalRows: 0 };
  }

  const headers = (data[0] || []).map((h: any) => String(h).trim());
  const rows = data.slice(1).filter((r) => r.some((c: any) => String(c).trim().length > 0));

  return {
    headers,
    rows,
    totalRows: rows.length,
  };
}
