/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { z } from "zod";
import type { AutomationNode, NodeContext, OutputField } from "../base";
import { prisma } from "@/lib/prisma";

// Config schema for Google Forms New Response Trigger
const configSchema = z.object({
  connectionId: z.string().min(1, "Google connection required"),
  formId: z.string().min(1, "Form ID required"),
  formTitle: z.string().optional(),
});

type Config = z.infer<typeof configSchema>;

// Output schema used by the execution engine for validation
const outputSchema = z.object({
  eventId: z.string().optional(),
  formId: z.string(),
  responseId: z.string(),
  submittedAt: z.string(),
  respondentEmail: z.string().nullable().optional(),
  // answers: map of question title -> value (string or other types)
  answers: z.record(z.string(), z.any()),
});

/**
 * Google Forms New Response Trigger
 * 
 * Features:
 * - Requires Google OAuth connection
 * - Fetches actual form structure from Google Forms API
 * - Generates dynamic output fields: answers.fieldName
 * - Triggered via webhook (Apps Script sends submissions)
 * - Webhook payload: { eventId, formId, responseId, answers: {...}, submittedAt, respondentEmail }
 */
export const googleFormsNewResponseTrigger: AutomationNode = {
  type: "google_forms.trigger.newResponse",
  category: "trigger",
  displayName: "Google Forms – New Response",
  description: "Trigger on new Google Form responses",
  configSchema,
  outputSchema,

  requiresConnection: true,
  provider: "google",

  // Static output fields
  outputFields: [
    {
      key: "eventId",
      label: "Event ID",
      type: "string",
      description: "Unique identifier for this webhook event (idempotency key)",
    },
    {
      key: "formId",
      label: "Form ID",
      type: "string",
      description: "Google Form ID",
    },
    {
      key: "responseId",
      label: "Response ID",
      type: "string",
      description: "Unique form response ID from Google Forms",
    },
    {
      key: "submittedAt",
      label: "Submitted At",
      type: "string",
      description: "ISO 8601 timestamp of submission",
    },
    {
      key: "respondentEmail",
      label: "Respondent Email",
      type: "string",
      description: "Email of form respondent (if available)",
    },
  ],

  /**
   * Get dynamic output fields by fetching form schema from Google
   */
  async getDynamicOutputFields(config: unknown, userId: string): Promise<OutputField[]> {
    try {
      const cfg = configSchema.parse(config);

      // Get connection
      const connection = await prisma.connection.findUnique({
        where: { id: cfg.connectionId },
      });

      if (!connection || connection.userId !== userId) {
        throw new Error("Connection not found or unauthorized");
      }

      // Fetch form schema from Google Forms API
      const { getFormSchema } = await import("./service");
      const schema = await getFormSchema(cfg.connectionId, cfg.formId);

      // Format schema as output fields (answers.fieldName, etc.)
      const dynamicFields = schema.questions.map((q) => ({
        key: `answers.${q.title}`,
        label: q.title,
        type: "string" as const,
        description: `Answer to: ${q.title}`,
      }));

      return dynamicFields;
    } catch (error) {
      console.error("[GoogleForms] Error getting dynamic fields:", error);
      return [];
    }
  },

  /**
   * Process webhook payload from Google Apps Script
   * 
   * Payload format:
   * {
   *   eventId: string,
   *   formId: string,
   *   responseId: string,
   *   answers: { "Question Title": "answer", ... },
   *   submittedAt: string (ISO 8601),
   *   respondentEmail?: string
   * }
   */
  async run(ctx: NodeContext) {
    // Input is the webhook payload
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = (ctx.input || {}) as any;
    // Parse config defensively; config may be absent during manual Execute
    const cfgResult = configSchema.safeParse(ctx.config);
    const cfg: Partial<Config> = cfgResult.success ? cfgResult.data : {};
    const executionMode = ctx.executionMode || "live";
    const isTest = executionMode === "test" || payload.__testTrigger === true;

    // If manually testing (no input), return test data
    const hasRealPayload = Boolean(payload.responseId && payload.answers);

    // If manually testing via explicit Test Trigger, return sample payload
    if (!hasRealPayload && isTest) {
      console.warn("[Google Forms Trigger] Test mode - returning sample payload");
      return {
        eventId: "test-event-id",
        formId: payload.formId || (cfg.formId ?? "test-form-id"),
        responseId: "test-response-id",
        submittedAt: new Date().toISOString(),
        respondentEmail: "test@example.com",
        answers: {
          email: "test@example.com",
          name: "Test User",
          message: "This is a test form submission",
        },
      };
    }

    if (!hasRealPayload) {
      throw new Error("Trigger has not received a real Google Form submission yet");
    }

    // Return normalized output matching template syntax: {{steps.trigger1.answers.fieldName}}
    return {
      eventId: payload.eventId,
      formId: payload.formId || (cfg.formId ?? "unknown-form-id"),
      responseId: payload.responseId,
      submittedAt: payload.submittedAt || new Date().toISOString(),
      respondentEmail: payload.respondentEmail || null,
      // Flatten answers for template resolution
      answers: payload.answers || {},
    };
  },
};
