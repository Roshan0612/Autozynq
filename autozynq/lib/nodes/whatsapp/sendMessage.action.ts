import { z } from "zod";
import { AutomationNode, NodeContext } from "../base";

// Config schema for WhatsApp Send Message action
const configSchema = z.object({
  phoneNumber: z.string().min(1, "Phone number required"),
  message: z.string().min(1, "Message required"),
});

// Output schema
const outputSchema = z.object({
  messageId: z.string(),
  delivered: z.boolean(),
});

type Config = z.infer<typeof configSchema>;

function interpolate(template: string, ctxInput: any): string {
  if (typeof template !== "string") return "";
  return template.replace(/\{{2}\s*([^}]+?)\s*\}{2}/g, (_match, p1) => {
    const path = String(p1).trim();
    const val = getNestedValue(ctxInput, path);
    return val != null ? String(val) : "";
  });
}

function getNestedValue(obj: any, path: string, fallback: any = ""): any {
  try {
    return path
      .split(".")
      .reduce((acc: any, key: string) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj) ?? fallback;
  } catch {
    return fallback;
  }
}

export const whatsappSendMessageAction: AutomationNode = {
  type: "whatsapp.action.sendMessage",
  category: "action",
  displayName: "WhatsApp Send Message",
  description: "Send a message via WhatsApp (outbound only)",
  configSchema,
  outputSchema,

  async run(ctx: NodeContext) {
    const cfg = configSchema.parse(ctx.config) as Config;

    // Resolve templated fields against prior output
    const prior = ctx.input || {};
    const phoneNumber = interpolate(cfg.phoneNumber, prior);
    const message = interpolate(cfg.message, prior);

    // Mock implementation: simulate successful WhatsApp message delivery
    // In production, would integrate with WhatsApp Business API
    const messageId = `whatsapp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[WhatsApp] Sent message to ${phoneNumber}: ${message}`);

    return outputSchema.parse({
      messageId,
      delivered: true,
    });
  },
};
