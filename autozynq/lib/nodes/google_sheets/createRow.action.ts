import { z } from "zod";
import { AutomationNode } from "../base";
import { getSheetInfo } from "@/lib/integrations/google/sheets";
import { getGoogleOAuthClient } from "@/lib/integrations/google/auth";
import { google } from "googleapis";

const configSchema = z.object({
  connectionId: z.string().min(1, "Connection ID is required"),
  spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
  spreadsheetName: z.string().optional(),
  sheetName: z.string().min(1, "Sheet name is required"),
  columnValues: z.record(z.string()).optional(), // columnName → value/expression
});

const outputSchema = z.object({
  spreadsheetId: z.string(),
  sheetId: z.number(),
  sheetName: z.string(),
  rowNumber: z.number(),
  values: z.record(z.any()),
});

export const googleSheetsCreateRowAction: AutomationNode = {
  type: "google_sheets.action.createRow",
  category: "action",
  displayName: "Google Sheets – Create Row",
  description: "Append a new row to a Google Sheet with mapped column values",
  icon: "table",
  app: "Google Sheets",
  requiresConnection: true,
  provider: "google",
  configSchema,
  outputSchema,
  outputFields: [
    { key: "spreadsheetId", label: "Spreadsheet ID", type: "string" },
    { key: "sheetId", label: "Sheet ID", type: "number" },
    { key: "sheetName", label: "Sheet Name", type: "string" },
    { key: "rowNumber", label: "Row Number", type: "number" },
    { key: "values", label: "Column Values", type: "object" },
  ],

  async run(ctx) {
    const config = ctx.config;

    // Validate config
    const parsed = configSchema.safeParse(config);
    if (!parsed.success) {
      throw new Error(`Invalid configuration: ${parsed.error.message}`);
    }

    const { connectionId, spreadsheetId, sheetName, columnValues } = parsed.data;

    if (!columnValues || Object.keys(columnValues).length === 0) {
      throw new Error("No column values provided");
    }

    // Get sheet metadata (sheetId, headers)
    const oauth2Client = await getGoogleOAuthClient(connectionId);
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });

    // Get sheet info
    const sheetInfo = await getSheetInfo(connectionId, spreadsheetId, sheetName);

    // Fetch headers from row 1
    const headersResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!1:1`,
    });

    const headers = headersResponse.data.values?.[0] || [];
    if (headers.length === 0) {
      throw new Error(`Sheet "${sheetName}" has no headers in row 1`);
    }

    // Build row array based on header order
    const rowValues: any[] = new Array(headers.length).fill("");
    
    for (const [columnName, value] of Object.entries(columnValues)) {
      const columnIndex = headers.findIndex((h) => h === columnName);
      if (columnIndex !== -1) {
        rowValues[columnIndex] = value || "";
      }
    }

    // Append row to sheet
    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${sheetName}'`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [rowValues],
      },
    });

    // Extract row number from update range (e.g., "Sheet1!A5:D5" → 5)
    const updatedRange = appendResponse.data.updates?.updatedRange || "";
    const rowNumberMatch = updatedRange.match(/!(\w+)(\d+):/);
    const rowNumber = rowNumberMatch ? parseInt(rowNumberMatch[2], 10) : 0;

    // Build output with column names
    const valuesObject: Record<string, any> = {};
    headers.forEach((header, index) => {
      valuesObject[header] = rowValues[index];
    });

    return {
      spreadsheetId,
      sheetId: sheetInfo.sheetId,
      sheetName,
      rowNumber,
      values: valuesObject,
    };
  },
};
