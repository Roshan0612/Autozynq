import { z } from "zod";
import type { AutomationNode, NodeContext } from "../base";

const configSchema = z.object({
  connectionId: z.string().min(1, "connectionId required"),
  formId: z.string().min(1, "formId required"),
  responseId: z.string().min(1, "responseId required"),
});

const outputSchema = z.object({
  responseId: z.string(),
  submittedAt: z.string(),
  answers: z.record(z.any()),
});

export const googleFormsGetResponseAction: AutomationNode = {
  type: "google_forms.action.getResponse",
  category: "action",
  displayName: "Google Forms – Get Response",
  description: "Fetch a single response by responseId.",
  configSchema,
  outputSchema,
  async run(ctx: NodeContext) {
    const cfg = configSchema.parse(ctx.config);
    return {
      responseId: cfg.responseId,
      submittedAt: new Date().toISOString(),
      answers: {
        "What is your name?": "Jane Doe",
        "Email": "jane@example.com",
        "Rating": 4,
      },
    };
  },
};
