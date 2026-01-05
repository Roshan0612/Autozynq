import { z } from "zod";
import type { AutomationNode, NodeContext } from "../base";

export const webhookTriggerNode: AutomationNode = {
  type: "trigger.webhook.basic",
  category: "trigger",
  displayName: "Webhook Trigger",
  description: "Start a workflow from an incoming HTTP webhook",
  configSchema: z.object({
    description: z.string().optional(),
  }),
  outputSchema: z.any(),
  async run(ctx: NodeContext) {
    // Webhook payload arrives as ctx.input
    return ctx.input;
  },
};
