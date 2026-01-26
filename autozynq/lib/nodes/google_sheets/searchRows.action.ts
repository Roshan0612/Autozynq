import { z } from "zod";
import type { AutomationNode, NodeContext } from "../base";
import { fetchSheetData, mapRowToValues, getSheetInfo } from "@/lib/integrations/google/sheets";

const configSchema = z.object({
  connectionId: z.string().min(1),
  spreadsheetId: z.string().min(1),
  sheetName: z.string().min(1),
  searchValue: z.string().min(1),
  searchColumn: z.string().default("ALL"),
  limit: z.number().int().min(1).optional(),
});

const outputSchema = z.object({
  rowNumber: z.number().int().min(1),
  matchedColumn: z.string(),
  values: z.record(z.string(), z.any()),
  rawValues: z.array(z.any()),
  spreadsheetId: z.string(),
  sheetId: z.number(),
});

export const googleSheetsSearchRowsAction: AutomationNode = {
  type: "google_sheets.action.searchRows",
  category: "action",
  displayName: "Google Sheets – Search Rows",
  description: "Search rows by value (contains, case-insensitive) across one column or all columns.",
  app: "Google Sheets",
  icon: "table",
  configSchema,
  outputSchema,
  requiresConnection: true,
  provider: "google",
  outputFields: [
    { key: "rowNumber", label: "Row Number", type: "number" },
    { key: "matchedColumn", label: "Matched Column", type: "string" },
    { key: "spreadsheetId", label: "Spreadsheet ID", type: "string" },
    { key: "sheetId", label: "Sheet ID", type: "number" },
  ],
  async run(ctx: NodeContext) {
    const cfg = configSchema.parse(ctx.config);
    const { sheetId } = await getSheetInfo(cfg.connectionId, cfg.spreadsheetId, cfg.sheetName);
    const headerIdx = 1;
    const data = await fetchSheetData(cfg.connectionId, cfg.spreadsheetId, cfg.sheetName, headerIdx);
    const headers = data.headers;

    const searchLower = cfg.searchValue.toLowerCase();
    const targetCol = cfg.searchColumn === "ALL" ? null : cfg.searchColumn;

    const outputs: any[] = [];

    for (const row of data.rows) {
      const raw = row.rawValues;
      const mapped = mapRowToValues(headers, raw);

      if (targetCol) {
        const idx = headers.indexOf(targetCol);
        if (idx !== -1) {
          const cell = String(raw[idx] ?? "").toLowerCase();
          if (cell.includes(searchLower)) {
            outputs.push({
              rowNumber: row.rowNumber,
              matchedColumn: targetCol,
              values: mapped,
              rawValues: raw,
              spreadsheetId: cfg.spreadsheetId,
              sheetId,
            });
          }
        }
      } else {
        let matchedCol: string | null = null;
        for (let i = 0; i < headers.length; i++) {
          const cell = String(raw[i] ?? "").toLowerCase();
          if (cell.includes(searchLower)) {
            matchedCol = headers[i];
            break;
          }
        }
        if (matchedCol) {
          outputs.push({
            rowNumber: row.rowNumber,
            matchedColumn: matchedCol,
            values: mapped,
            rawValues: raw,
            spreadsheetId: cfg.spreadsheetId,
            sheetId,
          });
        }
      }

      if (cfg.limit && outputs.length >= cfg.limit) break;
    }

    // If execution engine expects one output, return array. If it expects streaming, this can be adapted.
    // Here we return array of bundles; upstream can fan-out if needed.
    return outputs;
  },
};
