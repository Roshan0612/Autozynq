#!/usr/bin/env ts-node

import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { getGoogleOAuthClient } from "@/lib/integrations/google/auth";
import { getFormSchema, listNewResponses, normalizeAnswers } from "@/lib/integrations/google/forms";
import { runWorkflowIdempotent } from "@/lib/execution/idempotency";
import { getTriggerNodeFromDefinition } from "@/lib/workflow/schema";

async function processTrigger(trigger: any) {
  const { id, workflowId, formId, connectionId, lastResponseId } = trigger;
  try {
    // Determine trigger node id from workflow definition
    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);
    const def = workflow.definition as any;
    const triggerNode = getTriggerNodeFromDefinition(def);
    const triggerNodeId = triggerNode?.id || "trigger1";
    // Ensure tokens are fresh and clients ready
    const schema = await getFormSchema(connectionId, formId);

    // First-time seed: skip historical responses
    if (!lastResponseId) {
      const latest = await listNewResponses(connectionId, formId, undefined);
      const newestId = latest[0]?.responseId || null;
      await prisma.googleFormsTrigger.update({
        where: { id },
        data: { lastResponseId: newestId, lastCheckedAt: new Date() },
      });
      return;
    }

    const newResponses = await listNewResponses(connectionId, formId, lastResponseId || undefined);

    if (newResponses.length === 0) {
      await prisma.googleFormsTrigger.update({ where: { id }, data: { lastCheckedAt: new Date() } });
      return;
    }

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

      await runWorkflowIdempotent({
        workflowId,
        triggerInput: payload,
        nodeId: triggerNodeId,
        idempotency: { eventId: r.responseId!, nodeId: triggerNodeId },
      });
      newestId = r.responseId!;
    }

    await prisma.googleFormsTrigger.update({
      where: { id },
      data: { lastResponseId: newestId, lastCheckedAt: new Date() },
    });
  } catch (err: any) {
    console.error(`[Poll] Trigger ${id} failed (formId=${formId}, workflowId=${workflowId}): ${err?.message || err}`);
  }
}

async function pollOnce() {
  const active = await prisma.googleFormsTrigger.findMany({
    where: {
      active: true,
      workflow: { status: "ACTIVE" },
    },
    include: { workflow: true },
  });

  for (const t of active) {
    await processTrigger(t);
  }
}

async function main() {
  await pollOnce();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
