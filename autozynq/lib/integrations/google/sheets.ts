/* eslint-disable @typescript-eslint/no-explicit-any */
import { google } from "googleapis";
import { getGoogleOAuthClient } from "@/lib/integrations/google/auth";

export interface SheetRow {
  rowNumber: number;
  rawValues: string[];
}

export interface SheetData {
  spreadsheetId: string;
  sheetId: number;
  sheetName: string;
  headers: string[];
  rows: SheetRow[];
}

function formatRange(sheetName: string, rowStart: number, rowEnd?: number) {
  const endPart = rowEnd ? rowEnd.toString() : "";
  return `${sheetName}!${rowStart}:${endPart}`;
}

export async function getSheetInfo(
  connectionId: string,
  spreadsheetId: string,
  sheetName: string
): Promise<{ sheetId: number } > {
  const auth = await getGoogleOAuthClient(connectionId);
  const sheets = google.sheets({ version: "v4", auth });
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === sheetName);
  if (!sheet || sheet.properties?.sheetId == null) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }
  return { sheetId: sheet.properties.sheetId };
}

export function mapRowToValues(headers: string[], raw: string[]): Record<string, any> {
  const out: Record<string, any> = {};
  headers.forEach((h, i) => {
    out[h] = raw[i] ?? "";
  });
  return out;
}

export async function fetchSheetData(
  connectionId: string,
  spreadsheetId: string,
  sheetName: string,
  headerRowIndex = 1
): Promise<SheetData> {
  if (!spreadsheetId) throw new Error("Missing spreadsheetId");
  if (!sheetName) throw new Error("Missing sheetName");
  if (headerRowIndex < 1) throw new Error("headerRowIndex must be >= 1");

  try {
    const auth = await getGoogleOAuthClient(connectionId);
    const sheets = google.sheets({ version: "v4", auth });

    // Resolve sheetId
    const { sheetId } = await getSheetInfo(connectionId, spreadsheetId, sheetName);

    // Fetch header row
    const headerRange = formatRange(sheetName, headerRowIndex, headerRowIndex);
    const headerResp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: headerRange,
      majorDimension: "ROWS",
    });

    const headerRow = headerResp.data.values?.[0] || [];
    if (!headerRow.length) {
      throw new Error("Missing headers in sheet");
    }

    // Fetch all rows after header
    const dataRange = formatRange(sheetName, headerRowIndex + 1);
    const dataResp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: dataRange,
      majorDimension: "ROWS",
    });

    const rows: SheetRow[] = (dataResp.data.values || []).map((row, idx) => ({
      rowNumber: headerRowIndex + 1 + idx,
      rawValues: row as string[],
    }));

    return { spreadsheetId, sheetId, sheetName, headers: headerRow as string[], rows };
  } catch (err: any) {
    const message = err?.message || "Unknown Google Sheets error";
    if (message.toLowerCase().includes("unable to parse range")) {
      throw new Error("Invalid sheetName or range");
    }
    if (err?.code === 404) {
      throw new Error("Invalid spreadsheetId or sheet not found");
    }
    throw new Error(`Google Sheets API error: ${message}`);
  }
}

export async function fetchRow(
  connectionId: string,
  spreadsheetId: string,
  sheetName: string,
  rowNumber: number
) {
  if (rowNumber < 1) throw new Error("rowNumber must be >= 1");
  const auth = await getGoogleOAuthClient(connectionId);
  const sheets = google.sheets({ version: "v4", auth });
  const range = formatRange(sheetName, rowNumber, rowNumber);
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range, majorDimension: "ROWS" });
  const raw = (resp.data.values?.[0] || []) as string[];
  return raw;
}

export async function updateRowValues(
  connectionId: string,
  spreadsheetId: string,
  sheetName: string,
  rowNumber: number,
  fullRowValues: any[]
) {
  const auth = await getGoogleOAuthClient(connectionId);
  const sheets = google.sheets({ version: "v4", auth });
  const range = formatRange(sheetName, rowNumber, rowNumber);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [fullRowValues] },
  });
}
