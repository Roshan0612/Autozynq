/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { z } from "zod";
import type { AutomationNode, NodeContext } from "../base";
// @ts-expect-error - nodemailer types are missing
import nodemailer from "nodemailer";

const configSchema = z.object({
  to: z.string().min(1, "to required"),
  subject: z.string().min(1, "subject required"),
  body: z.string().min(1, "body required"),
  from: z.string().optional(),
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
  return template.replace(/\{{2}\s*([^}]+?)\s*\}{2}/g, (_m, p1) => {
    const path = String(p1).trim();
    const val = get(ctxInput, path, "");
    return val != null ? String(val) : "";
  });
}

export const smtpSendEmailAction: AutomationNode = {
  type: "email.smtp.send",
  category: "action",
  displayName: "SMTP Send Email",
  description: "Send an email via SMTP using Nodemailer",
  configSchema,
  outputSchema,
  outputFields: [],
  requiresConnection: false,
  async run(ctx: NodeContext) {
    const cfg = configSchema.parse(ctx.config) as Config;

    const prior = ctx.input || {};
    const to = interpolate(cfg.to, prior);
    const subject = interpolate(cfg.subject, prior);
    const body = interpolate(cfg.body, prior);

    // Env defaults
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = cfg.from || process.env.SMTP_FROM;
    const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";

    if (!host || !port || !from) {
      console.warn("[SMTP] Missing SMTP env (SMTP_HOST/SMTP_PORT/SMTP_FROM). Falling back to mock send.");
      const sentId = `mock_${Date.now()}`;
      console.log(`[SMTP] Mock sent to ${to}: ${subject}`);
      return outputSchema.parse({ id: sentId, status: "sent", to, subject });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure, // true for 465, false for others
      auth: user && pass ? { user, pass } : undefined,
    });

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text: body,
    });

    console.log(`[SMTP] Sent email to ${to}: ${subject} (id: ${info.messageId || "unknown"})`);

    return outputSchema.parse({ id: info.messageId || `smtp_${Date.now()}` , status: "sent", to, subject });
  },
};
