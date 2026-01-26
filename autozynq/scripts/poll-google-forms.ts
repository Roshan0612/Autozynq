#!/usr/bin/env ts-node

import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { getGoogleOAuthClient } from "@/lib/integrations/google/auth";
import { getFormSchema, listNewResponses, normalizeAnswers } from "@/lib/integrations/google/forms";
import { runWorkflowIdempotent } from "@/lib/execution/idempotency";
import { getTriggerNodeFromDefinition } from "@/lib/workflow/schema";

async function processTrigger(trigger: any) {
  const { id, workflowId, formId, connectionId, lastResponseId } = trigger;
  console.log(`[Poll] Processing trigger ${id}: lastResponseId from DB = ${lastResponseId || "NULL"}`);
  try {
    // Determine trigger node id from workflow definition
    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);
    const def = workflow.definition as any;
    const triggerNode = getTriggerNodeFromDefinition(def);
    const triggerNodeId = triggerNode?.id || "trigger1";
    // Ensure tokens are fresh and clients ready
    const schema = await getFormSchema(connectionId, formId);
    
    console.log(`[Poll] Form schema retrieved for form ${formId}:`);
    console.log(`[Poll]   Form Title: ${schema.title}`);
    console.log(`[Poll]   Questions:`);
    schema.questions.forEach((q: any) => {
      console.log(`[Poll]     - ID: ${q.id}, Title: "${q.title}", Type: ${q.type}`);
    });

    // Get all responses if first poll (lastResponseId = null), otherwise only newer ones
    const newResponses = await listNewResponses(connectionId, formId, lastResponseId || undefined);

    if (newResponses.length === 0) {
      console.log(`[Poll] No new responses found for formId=${formId}. Last checked: ${lastResponseId || "N/A"}`);
      await prisma.googleFormsTrigger.update({ where: { id }, data: { lastCheckedAt: new Date() } });
      return;
    }

    console.log(`[Poll] Found ${newResponses.length} new response(s) for formId=${formId}`);

    // Process newest-first; update lastResponseId to the first element's responseId
    let newestId = lastResponseId || null;
    for (const r of newResponses.reverse()) { // oldest to newest for execution order
      const answers = normalizeAnswers(schema, r);
      const payload = {
        trigger: "google_forms.new_response",
        formId,
        responseId: r.responseId!,
        submittedAt: r.createTime || r.lastSubmittedTime || new Date().toISOString(),
        answers,
      };

      console.log(`[Poll] Found new response: ${r.responseId}. Executing workflow in live mode...`);
      
      const result = await runWorkflowIdempotent({
        workflowId,
        triggerInput: payload,
        executionMode: "live",
        idempotency: { eventId: r.responseId!, nodeId: triggerNodeId },
      });
      
      console.log(`[Poll] Workflow execution completed for response ${r.responseId}. Execution: ${result.executionId}, Duplicate: ${result.isDuplicate}`);
      newestId = r.responseId!;
    }

    await prisma.googleFormsTrigger.update({
      where: { id },
      data: { lastResponseId: newestId, lastCheckedAt: new Date() },
    });

    console.log(`[Poll] Successfully processed ${newResponses.length} response(s). Updated lastResponseId to: ${newestId}`);
  } catch (err: any) {
    const details = err?.response?.data || err?.data || err?.stack || err?.message || err;
    console.error(
      `[Poll] Trigger ${id} failed (formId=${formId}, workflowId=${workflowId}): ${err?.message || err}`
    );
    if (details) {
      console.error("[Poll] Error details:", details);
    }
  }
}

async function pollOnce() {
  console.log("[Poll] Starting polling cycle...");
  
  const active = await prisma.googleFormsTrigger.findMany({
    where: {
      active: true,
      workflow: { status: "ACTIVE" },
    },
    include: { workflow: true },
  });

  console.log(`[Poll] Found ${active.length} active Google Forms trigger(s)`);

  for (const t of active) {
    await processTrigger(t);
  }

  console.log("[Poll] Polling cycle complete");
}

async function main() {
  await pollOnce();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
