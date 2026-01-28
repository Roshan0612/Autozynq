/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { z } from "zod";
import type { AutomationNode, NodeContext, OutputField } from "../base";

const configSchema = z.object({
  connectionId: z.string().min(1),
  spreadsheetId: z.string().min(1),
  sheetName: z.string().min(1),
  fromRow: z.number().int().min(2).default(2),
  limit: z.number().int().min(1).optional(),
  startMode: z.enum(["from_now", "all_existing_rows"]).default("from_now"),
});

const outputSchema = z.object({
  rowNumber: z.number().int().min(1),
  values: z.record(z.string(), z.any()),
  rawValues: z.array(z.any()),
  spreadsheetId: z.string(),
  sheetId: z.number(),
  sheetName: z.string(),
});

export const googleSheetsWatchNewRowsTrigger: AutomationNode = {
  type: "google_sheets.trigger.watchNewRows",
  category: "trigger",
  displayName: "Google Sheets – Watch New Rows",
  description: "Poll a Google Sheet and emit one bundle per new row.",
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
    { key: "sheetName", label: "Sheet Name", type: "string" },
  ],
  async run(ctx: NodeContext) {
    // For polling triggers, the poller passes a fully-formed payload.
    // This node validates and returns it as-is. No test mode, no synthetic data.
    const payload = ctx.input as unknown;
    const parsed = outputSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error("Invalid Google Sheets trigger payload");
    }
    return parsed.data;
  },
};
