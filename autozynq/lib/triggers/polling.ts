import { prisma } from "../prisma";
import { runWorkflow } from "../execution/engine";
import { getGoogleOAuthClient } from "../integrations/google/auth";
import { google } from "googleapis";

/**
 * Polling Service for Google Forms Triggers
 * 
 * Periodically checks for new form responses and triggers workflows.
 * Uses lastPolledAt timestamp to track which responses have been processed.
 */

interface PollingState {
  lastPolledAt: Date;
  lastResponseId?: string;
}

/**
 * Poll a single Google Forms trigger for new responses
 */
async function pollFormTrigger(triggerId: string): Promise<number> {
  const trigger = await prisma.workflowTrigger.findUnique({
    where: { id: triggerId },
    include: { workflow: true },
  });

  if (!trigger || !trigger.isActive) {
    console.log(`[Polling] Trigger ${triggerId} not found or inactive, skipping`);
    return 0;
  }

  if (trigger.workflow.status !== "ACTIVE") {
    console.log(`[Polling] Workflow ${trigger.workflowId} not active, skipping`);
    return 0;
  }

  const config = trigger.config as any;
  const connectionId = config.connectionId;
  const formId = config.formId;

  if (!connectionId || !formId) {
    console.warn(`[Polling] Trigger ${triggerId} missing connectionId or formId`);
    return 0;
  }

  try {
    // Get OAuth client
    const oauth2Client = await getGoogleOAuthClient(connectionId);
    const forms = google.forms({ version: "v1", auth: oauth2Client });

    // Get polling state from metadata
    const metadata = (trigger.metadata || {}) as any;
    const pollingState: PollingState = metadata.pollingState || {
      lastPolledAt: new Date(0), // epoch start
    };

    // Fetch responses
    const response = await forms.forms.responses.list({
      formId,
    });

    const responses = response.data.responses || [];
    
    // Filter responses newer than last poll
    const newResponses = responses.filter((r) => {
      const submittedTime = r.lastSubmittedTime ? new Date(r.lastSubmittedTime) : new Date(0);
      return submittedTime > pollingState.lastPolledAt;
    });
    
    console.log(`[Polling] Found ${newResponses.length} new responses for form ${formId} (total: ${responses.length})`);

    let executedCount = 0;

    // Process each new response
    for (const formResponse of newResponses) {
      const responseId = formResponse.responseId;
      const submittedAt = formResponse.lastSubmittedTime || new Date().toISOString();

      // Convert answers to flat object
      const answers: Record<string, any> = {};
      if (formResponse.answers) {
        for (const [questionId, answer] of Object.entries(formResponse.answers)) {
          const ans = answer as any;
          // Get question title from form schema (for now use questionId)
          const value = ans.textAnswers?.answers?.[0]?.value || 
                       ans.fileUploadAnswers?.answers?.[0]?.fileId ||
                       null;
          
          // Try to get question text from the form
          const formSchema = await forms.forms.get({ formId });
          const item = formSchema.data.items?.find((i: any) => i.questionItem?.question?.questionId === questionId);
          const questionTitle = item?.title || questionId;
          
          answers[questionTitle] = value;
        }
      }

      const triggerInput = {
        eventId: `form-response-${responseId}`,
        formId,
        responseId: responseId!,
        submittedAt,
        respondentEmail: formResponse.respondentEmail || null,
        answers,
      };

      console.log(`[Polling] Executing workflow for response ${responseId}`);

      try {
        await runWorkflow({
          workflowId: trigger.workflowId,
          triggerInput,
          userId: trigger.workflow.userId,
          idempotencyKey: triggerInput.eventId,
        });
        executedCount++;
      } catch (error: any) {
        console.error(`[Polling] Failed to execute workflow for response ${responseId}:`, error.message);
      }
    }

    // Update polling state
    if (newResponses.length > 0) {
      const newState: PollingState = {
        lastPolledAt: new Date(),
        lastResponseId: newResponses[newResponses.length - 1].responseId || undefined,
      };

      await prisma.workflowTrigger.update({
        where: { id: triggerId },
        data: {
          metadata: {
            ...metadata,
            pollingState: newState,
          },
        },
      });
    }

    return executedCount;
  } catch (error: any) {
    console.error(`[Polling] Error polling form ${formId}:`, error.message);
    return 0;
  }
}

/**
 * Poll all active Google Forms triggers
 */
export async function pollAllFormTriggers(): Promise<{ total: number; executed: number }> {
  console.log("[Polling] Starting poll cycle for Google Forms triggers");

  // Find all active Google Forms triggers
  const triggers = await prisma.workflowTrigger.findMany({
    where: {
      isActive: true,
      type: "WEBHOOK", // Google Forms triggers are stored as WEBHOOK type
    },
    include: {
      workflow: true,
    },
  });

  // Filter to only Google Forms triggers
  const formTriggers = triggers.filter((t) => {
    const config = t.config as any;
    return config?.formId && (t.workflow.definition as any)?.nodes?.some(
      (n: any) => n.id === t.nodeId && n.type === "google_forms.trigger.newResponse"
    );
  });

  console.log(`[Polling] Found ${formTriggers.length} active Google Forms triggers`);

  let totalExecuted = 0;
  for (const trigger of formTriggers) {
    const executed = await pollFormTrigger(trigger.id);
    totalExecuted += executed;
  }

  console.log(`[Polling] Poll cycle complete. Executed ${totalExecuted} workflows from ${formTriggers.length} triggers`);

  return {
    total: formTriggers.length,
    executed: totalExecuted,
  };
}

/**
 * Start polling service with configurable interval
 */
export function startPollingService(intervalMs: number = 30000): NodeJS.Timeout {
  console.log(`[Polling] Starting polling service (interval: ${intervalMs}ms)`);

  // Run immediately
  pollAllFormTriggers().catch((err) => {
    console.error("[Polling] Initial poll failed:", err);
  });

  // Then poll on interval
  return setInterval(() => {
    pollAllFormTriggers().catch((err) => {
      console.error("[Polling] Poll cycle failed:", err);
    });
  }, intervalMs);
}
