import { z } from "zod";
import type { AutomationNode, NodeContext } from "../base";

// Config schema for Google Forms New Response Trigger
const configSchema = z.object({
  formId: z.string().min(1, "Form ID required"),
  includeAttachments: z.boolean().default(false),
  conditions: z
    .array(
      z.object({
        field: z.string(),
        operator: z.enum(["equals", "contains", "exists"]),
        value: z.string().optional(),
      })
    )
    .optional(),
});

// Output schema: normalized response data from webhook payload
const outputSchema = z.object({
  responseId: z.string(),
  submittedAt: z.string(),
  answers: z.record(z.union([z.string(), z.array(z.string())])),
  attachments: z.array(z.string()).optional(),
});

type Config = z.infer<typeof configSchema>;

/**
 * Google Forms New Response Trigger
 * 
 * Triggered ONLY via existing webhook infrastructure.
 * Receives raw webhook payload, applies optional conditions, outputs normalized response.
 */
export const googleFormsNewResponseTrigger: AutomationNode = {
  type: "google_forms.trigger.newResponse",
  category: "trigger",
  displayName: "Google Forms – New Response",
  description: "Trigger on new Google Form responses via webhook",
  configSchema,
  outputSchema,

  async run(ctx: NodeContext) {
    const cfg = configSchema.parse(ctx.config) as Config;

    // Input is the raw webhook payload
    const payload = ctx.input as any || {};

    // Extract response data from payload
    const responseId = payload.responseId || `resp_${Date.now()}`;
    const submittedAt = payload.timestamp || new Date().toISOString();
    const answers = payload.answers || {};
    const attachments = cfg.includeAttachments ? payload.attachments : undefined;

    // Apply optional conditions filter
    if (cfg.conditions && cfg.conditions.length > 0) {
      for (const condition of cfg.conditions) {
        const fieldValue = answers[condition.field];

        if (condition.operator === "exists") {
          if (!fieldValue) {
            throw new Error(`Condition failed: field '${condition.field}' does not exist`);
          }
        } else if (condition.operator === "equals") {
          if (fieldValue !== condition.value) {
            throw new Error(`Condition failed: field '${condition.field}' does not equal '${condition.value}'`);
          }
        } else if (condition.operator === "contains") {
          const fieldStr = String(fieldValue || "");
          if (!fieldStr.includes(String(condition.value || ""))) {
            throw new Error(`Condition failed: field '${condition.field}' does not contain '${condition.value}'`);
          }
        }
      }
    }

    return outputSchema.parse({
      responseId,
      submittedAt,
      answers,
      attachments,
    });
  },
};
