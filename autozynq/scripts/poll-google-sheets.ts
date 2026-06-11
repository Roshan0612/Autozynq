#!/usr/bin/env ts-node

import { prisma } from "@/lib/prisma";
import { runWorkflowIdempotent } from "@/lib/execution/idempotency";
import { getTriggerNodeFromDefinition } from "@/lib/workflow/schema";
import { fetchSheetData, mapRowToValues } from "@/lib/integrations/google/sheets";

async function processTrigger(trigger: any) {
  const { id, workflowId, spreadsheetId, sheetName, headerRowIndex, lastProcessedRow, startMode } = trigger;

  console.log(
    `[Sheets] Processing trigger ${id} (workflow=${workflowId}, sheet=${sheetName}) lastProcessedRow=${lastProcessedRow}`
  );

  try {
    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);

    const def = workflow.definition as any;
    const triggerNode = getTriggerNodeFromDefinition(def);
    if (!triggerNode || triggerNode.type !== "google_sheets.trigger.watchNewRows") {
      throw new Error("Trigger node type mismatch or not found in workflow definition");
    }
    const triggerNodeId = triggerNode.id;
    const cfg = triggerNode.config || {};
    const connectionId = cfg.connectionId;
    if (!connectionId) throw new Error("connectionId missing in trigger node config");

    const fromRow: number = cfg.fromRow ?? 2;
    const limit: number | undefined = cfg.limit;

    const data = await fetchSheetData(connectionId, spreadsheetId, sheetName, headerRowIndex || 1);

    const totalFetched = data.rows.length;
    let cursor = typeof lastProcessedRow === "number" ? lastProcessedRow : headerRowIndex || 1;

    // Respect from_now vs all_existing_rows on first runs if needed (assumes DB set correctly normally)
    if (!lastProcessedRow && startMode === "from_now") {
      // initialize cursor to max existing row to skip historical rows
      if (data.rows.length > 0) {
        const lastRow = data.rows[data.rows.length - 1].rowNumber;
        cursor = lastRow;
      }
    }

    const candidateRows = data.rows.filter((r) => r.rowNumber > cursor && r.rowNumber >= fromRow);

    let emitted = 0;
    let skipped = totalFetched - candidateRows.length;

    console.log(
      `[Sheets] Rows fetched=${totalFetched}, candidates=${candidateRows.length}, skipped=${skipped}`
    );

    let maxProcessed = cursor;
    for (const row of candidateRows) {
      const values = mapRowToValues(data.headers, row.rawValues);
      const payload = {
        rowNumber: row.rowNumber,
        values,
        rawValues: row.rawValues,
        spreadsheetId: data.spreadsheetId,
        sheetId: data.sheetId,
        sheetName: data.sheetName,
      };

      const eventId = `${spreadsheetId}-${sheetName}-${row.rowNumber}`;
      const result = await runWorkflowIdempotent({
        workflowId,
        triggerInput: payload,
        executionMode: "live",
        idempotency: { eventId, nodeId: triggerNodeId },
      });

      if (!result.isDuplicate) emitted += 1;
      maxProcessed = Math.max(maxProcessed, row.rowNumber);

      if (limit && emitted >= limit) break;
    }

    await prisma.googleSheetsTrigger.update({
      where: { id },
      data: { lastProcessedRow: maxProcessed, lastCheckedAt: new Date() },
    });

    console.log(
      `[Sheets] Emitted=${emitted}, Updated lastProcessedRow=${maxProcessed} for trigger ${id}`
    );
  } catch (err: any) {
    const details = err?.response?.data || err?.data || err?.stack || err?.message || err;
    console.error(
      `[Sheets] Trigger ${id} failed (spreadsheetId=${spreadsheetId}, sheetName=${sheetName}, workflowId=${workflowId}): ${
        err?.message || err
      }`
    );
    if (details) {
      console.error("[Sheets] Error details:", details);
    }
  }
}

async function pollOnce() {
  console.log("[Sheets] Starting polling cycle...");

  const triggers = await prisma.googleSheetsTrigger.findMany({
    where: { workflow: { status: "ACTIVE" } },
    include: { workflow: true },
  });

  console.log(`[Sheets] Found ${triggers.length} trigger(s)`);

  for (const t of triggers) {
    await processTrigger(t);
  }

  console.log("[Sheets] Polling cycle complete");
}

async function main() {
  await pollOnce();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
