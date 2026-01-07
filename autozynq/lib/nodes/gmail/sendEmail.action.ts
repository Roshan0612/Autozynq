import { z } from "zod";
import { AutomationNode, NodeContext } from "../base";

const configSchema = z.object({
  connectionId: z.string().min(1, "connectionId required"),
  to: z.string().min(1, "to required"),
  subject: z.string().min(1, "subject required"),
  body: z.string().min(1, "body required"),
});

const outputSchema = z.object({
  id: z.string(),
  status: z.literal("sent"),
  to: z.string(),
  subject: z.string(),
});

type Config = z.infer<typeof configSchema>;

function get(obj: any, path: string, fallback: any = ""): any {
  try {
    return path
      .split(".")
      .reduce((acc: any, key: string) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj) ?? fallback;
  } catch {
    return fallback;
  }
}

function interpolate(template: string, ctxInput: any): string {
  if (typeof template !== "string") return "";
  return template.replace(/\{{2}\s*([^}]+?)\s*\}{2}/g, (_match, p1) => {
    const path = String(p1).trim();
    const val = get(ctxInput, path, "");
    return val != null ? String(val) : "";
  });
}

export const gmailSendEmailAction: AutomationNode = {
  type: "gmail.action.sendEmail",
  category: "action",
  displayName: "Gmail Send Email",
  description: "Send an email via Gmail (mock)",
  configSchema,
  outputSchema,
  async run(ctx: NodeContext) {
    const cfg = configSchema.parse(ctx.config) as Config;

    // Resolve templated fields against prior output
    const prior = ctx.input || {};
    const to = interpolate(cfg.to, prior);
    const subject = interpolate(cfg.subject, prior);
    const body = interpolate(cfg.body, prior);

    // In a real impl, use cfg.connectionId OAuth to call Gmail API
    // For demo we simulate success
    const sentId = `msg_${Date.now()}`;
    console.log(`[Gmail] Sent mock email to ${to}: ${subject}`);

    return outputSchema.parse({ id: sentId, status: "sent", to, subject });
  },
};
