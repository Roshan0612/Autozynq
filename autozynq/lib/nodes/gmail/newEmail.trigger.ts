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

// Mock Gmail trigger that simulates new email events
export const gmailNewEmailTrigger: AutomationNode = {
  type: "gmail.trigger.newEmail",
  category: "trigger",
  displayName: "New Email",
  description: "Triggers when a new email is received in Gmail",
  configSchema,
  outputSchema,
  outputFields: [],
  requiresConnection: false,

  async run(ctx: NodeContext) {
    const config = configSchema.parse(ctx.config);

    // In production, this would poll Gmail API or use webhooks
    // For now, return mock data to validate the system
    const mockEmail = {
      id: `email_${Date.now()}`,
      subject: `Test Email - ${config.label}`,
      from: config.from || "sender@example.com",
      body: "This is a mock email for testing the automation platform.",
      timestamp: new Date(),
    };

    console.log(`[Gmail Trigger] Simulated new email:`, mockEmail);
    return outputSchema.parse(mockEmail);
  },
};
