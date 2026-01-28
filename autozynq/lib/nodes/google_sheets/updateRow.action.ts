/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { z } from "zod";
import type { AutomationNode, NodeContext } from "../base";
import { fetchSheetData, fetchRow, mapRowToValues, updateRowValues, getSheetInfo } from "@/lib/integrations/google/sheets";

const configSchema = z.object({
  connectionId: z.string().min(1),
  spreadsheetId: z.string().min(1),
  sheetName: z.string().min(1),
  rowNumber: z.number().int().min(1),
  values: z.record(z.string(), z.any()),
});

const outputSchema = z.object({
  rowNumber: z.number().int().min(1),
  updatedValues: z.record(z.string(), z.any()),
  spreadsheetId: z.string(),
  sheetId: z.number(),
});

export const googleSheetsUpdateRowAction: AutomationNode = {
  type: "google_sheets.action.updateRow",
  category: "action",
  displayName: "Google Sheets – Update Row",
  description: "Update only specified columns in a row, preserving others.",
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

    const existing = await fetchRow(cfg.connectionId, cfg.spreadsheetId, cfg.sheetName, cfg.rowNumber);
    if (!existing || existing.length === 0) {
      throw new Error(`Row ${cfg.rowNumber} not found in sheet ${cfg.sheetName}`);
    }

    const fullRow = [...existing];
    for (const [key, val] of Object.entries(cfg.values)) {
      const idx = headers.indexOf(key);
      if (idx === -1) {
        throw new Error(`Column not found in header: ${key}`);
      }
      fullRow[idx] = val as any;
    }

    await updateRowValues(cfg.connectionId, cfg.spreadsheetId, cfg.sheetName, cfg.rowNumber, fullRow);

    return {
      rowNumber: cfg.rowNumber,
      updatedValues: cfg.values,
      spreadsheetId: cfg.spreadsheetId,
      sheetId,
    };
  },
};
