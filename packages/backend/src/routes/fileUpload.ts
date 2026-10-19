import { IncomingMessage } from 'http';
import * as XLSX from 'xlsx';

function extractTextFromHTML(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim();
}

function extractTextFromExcel(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const lines: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    for (const row of data) {
      const rowText = row.filter((v) => v != null).join(' | ');
      if (rowText) lines.push(rowText);
    }
  }
  return lines.join('\n');
}

export async function parseFileUpload(req: IncomingMessage): Promise<{ text: string; filename: string; size: number }> {
  const contentType = req.headers['content-type'] || '';
  const boundary = contentType.split('boundary=')[1]?.trim();
  if (!boundary) throw new Error('No boundary in Content-Type');

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks);

  const parts = raw.toString('latin1').split(`--${boundary}`);
  let fileBuffer: Buffer | null = null;
  let filename = '';

  for (const part of parts) {
    if (part.includes('Content-Disposition') && part.includes('filename="')) {
      const headerEnd = part.indexOf('\r\n\r\n');
      if (headerEnd === -1) continue;
      const header = part.slice(0, headerEnd);
      const fnMatch = header.match(/filename="(.+?)"/);
      if (fnMatch) filename = fnMatch[1];
      const bodyStart = headerEnd + 4;
      const bodyEnd = part.lastIndexOf('\r\n');
      const bodyStr = part.slice(bodyStart, bodyEnd > bodyStart ? bodyEnd : undefined);
      fileBuffer = Buffer.from(bodyStr, 'latin1');
      break;
    }
  }

  if (!fileBuffer) throw new Error('No file found in upload');
  if (!filename) throw new Error('No filename in upload');

  const ext = filename.split('.').pop()?.toLowerCase() || '';
  let rawText = '';

  switch (ext) {
    case 'md': case 'txt': case 'csv':
      rawText = fileBuffer.toString('utf-8');
      break;
    case 'html': case 'htm':
      rawText = extractTextFromHTML(fileBuffer.toString('utf-8'));
      break;
    case 'xlsx': case 'xls':
      rawText = extractTextFromExcel(fileBuffer);
      break;
    default:
      throw new Error(`Unsupported file type: .${ext}`);
  }

  if (!rawText.trim()) throw new Error('File is empty');

  const maxLen = 50000;
  if (rawText.length > maxLen) {
    rawText = rawText.slice(0, maxLen) + `\n\n[截断: 共 ${rawText.length} 字符]`;
  }

  return { text: rawText, filename, size: fileBuffer.length };
}
