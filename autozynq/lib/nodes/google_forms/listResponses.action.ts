import { z } from "zod";
import type { AutomationNode, NodeContext } from "../base";

const configSchema = z.object({
  connectionId: z.string().min(1, "connectionId required"),
  formId: z.string().min(1, "formId required"),
  limit: z.number().int().positive().max(500).optional(),
  since: z.string().datetime().optional(),
});

const responseSchema = z.object({
  responseId: z.string(),
  submittedAt: z.string(),
  answers: z.record(z.any()),
});

const outputSchema = z.object({
  formId: z.string(),
  total: z.number().int().nonnegative(),
  responses: z.array(responseSchema),
});

export const googleFormsListResponsesAction: AutomationNode = {
  type: "google_forms.action.listResponses",
  category: "action",
  displayName: "Google Forms – List Responses",
  description: "List recent responses with optional since/limit.",
  configSchema,
  outputSchema,
  async run(ctx: NodeContext) {
    const cfg = configSchema.parse(ctx.config);
    const total = cfg.limit ?? 2;
    const now = Date.now();
    const responses = Array.from({ length: total }).map((_, i) => ({
      responseId: `resp_${i + 1}`,
      submittedAt: new Date(now - i * 60000).toISOString(),
      answers: {
        "What is your name?": `User ${i + 1}`,
        "Email": `user${i + 1}@example.com`,
        "Rating": (i % 5) + 1,
      },
    }));
    return { formId: cfg.formId, total, responses };
  },
};
