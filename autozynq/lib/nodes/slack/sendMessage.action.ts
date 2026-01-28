import { z } from "zod";
import type { AutomationNode, NodeContext } from "../base";

// Schema for action configuration stored in workflow JSON
const configSchema = z.object({
  channel: z.string().min(1, "Channel is required"),
  message: z.string().min(1, "Message is required"),
});

// Schema for data emitted by this action
const outputSchema = z.object({
  success: z.boolean(),
  channelId: z.string(),
  messageId: z.string(),
  timestamp: z.date(),
});

// Mock Slack action that simulates sending messages
export const slackSendMessageAction: AutomationNode = {
  type: "slack.action.sendMessage",
  category: "action",
  displayName: "Send Message",
  description: "Sends a message to a Slack channel",
  configSchema,
  outputSchema,
  outputFields: [],
  requiresConnection: false,

  async run(ctx: NodeContext) {
    const config = configSchema.parse(ctx.config);

    // Log incoming data from previous node
    console.log(`[Slack Action] Received input from previous node:`, ctx.input);

    // In production, this would call Slack API with ctx.auth tokens
    // For now, simulate success
    const result = {
      success: true,
      channelId: config.channel,
      messageId: `msg_${Date.now()}`,
      timestamp: new Date(),
    };

    console.log(`[Slack Action] Message sent to ${config.channel}:`, config.message);
    return outputSchema.parse(result);
  },
};
