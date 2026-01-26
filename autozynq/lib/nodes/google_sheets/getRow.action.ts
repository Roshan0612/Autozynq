import { z } from "zod";
import type { AutomationNode, NodeContext } from "../base";
import { fetchSheetData, fetchRow, mapRowToValues, getSheetInfo } from "@/lib/integrations/google/sheets";

const configSchema = z.object({
  connectionId: z.string().min(1),
  spreadsheetId: z.string().min(1),
  sheetName: z.string().min(1),
  rowNumber: z.number().int().min(1),
});

const outputSchema = z.object({
  rowNumber: z.number().int().min(1),
  values: z.record(z.string(), z.any()),
  rawValues: z.array(z.any()),
  spreadsheetId: z.string(),
  sheetId: z.number(),
});

export const googleSheetsGetRowAction: AutomationNode = {
  type: "google_sheets.action.getRow",
  category: "action",
  displayName: "Google Sheets – Get Row",
  description: "Fetch a single row by number and map values using the header row.",
  app: "Google Sheets",
  icon: "table",
  configSchema,
  outputSchema,
  requiresConnection: true,
  provider: "google",
  outputFields: [
    { key: "rowNumber", label: "Row Number", type: "number" },
    { key: "spreadsheetId", label: "Spreadsheet ID", type: "string" },
    { key: "sheetId", label: "Sheet ID", type: "number" },
  ],
  async run(ctx: NodeContext) {
    const cfg = configSchema.parse(ctx.config);
    const { sheetId } = await getSheetInfo(cfg.connectionId, cfg.spreadsheetId, cfg.sheetName);
    const headerIdx = 1;
    const data = await fetchSheetData(cfg.connectionId, cfg.spreadsheetId, cfg.sheetName, headerIdx);
    const headers = data.headers;

    const raw = await fetchRow(cfg.connectionId, cfg.spreadsheetId, cfg.sheetName, cfg.rowNumber);
    if (!raw || raw.length === 0) {
      throw new Error(`Row ${cfg.rowNumber} not found or empty in sheet ${cfg.sheetName}`);
    }
    const values = mapRowToValues(headers, raw);
    return {
      rowNumber: cfg.rowNumber,
      values,
      rawValues: raw,
      spreadsheetId: cfg.spreadsheetId,
      sheetId,
    };
  },
};
