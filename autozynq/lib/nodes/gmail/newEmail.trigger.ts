import { z } from "zod";
import type { AutomationNode, NodeContext } from "../base";

// Schema for trigger configuration stored in workflow JSON
const configSchema = z.object({
  label: z.string().min(1, "Label is required"),
  from: z.string().email().optional(),
});

// Schema for data emitted by this trigger
const outputSchema = z.object({
  id: z.string(),
  subject: z.string(),
  from: z.string(),
  body: z.string(),
  timestamp: z.date(),
});

// Gmail trigger for new email events (production only)
export const gmailNewEmailTrigger: AutomationNode = {
  type: "gmail.trigger.newEmail",
  category: "trigger",
  displayName: "New Email",
  description: "Triggers when a new email is received in Gmail",
  configSchema,
  outputSchema,
  outputFields: [],
  requiresConnection: true,

  async run(ctx: NodeContext) {
    const config = configSchema.parse(ctx.config);
    // TODO: Implement Gmail API polling or webhook logic here for production
    throw new Error("Gmail trigger is not implemented in production mode.");
  },
};
