import { z } from "zod";
import type { AutomationNode, NodeContext } from "../base";

// Config: connection + formId + optional since (ISO)
const configSchema = z.object({
  connectionId: z.string().min(1, "connectionId required"),
  formId: z.string().min(1, "formId required"),
  since: z.string().datetime().optional(),
});

// Output: normalized response
const outputSchema = z.object({
  responseId: z.string(),
  submittedAt: z.string(),
  answers: z.record(z.any()),
});

export const googleFormsNewResponseTrigger: AutomationNode = {
  type: "google_forms.trigger.newResponse",
  category: "trigger",
  displayName: "Google Forms – New Response (Polling)",
  description: "Poll a form for new responses since a timestamp.",
  configSchema,
  outputSchema,
  async run(ctx: NodeContext) {
    const cfg = configSchema.parse(ctx.config);
    // Mock polling: emit one fake response shaped as required.
    // In real impl, would call Google Forms API with OAuth token from cfg.connectionId.
    const now = new Date().toISOString();
    return {
      responseId: "resp_mock_123",
      submittedAt: now,
      answers: {
        "What is your name?": "John Doe",
        "Email": "john@example.com",
        "Rating": 5,
      },
    };
  },
};
