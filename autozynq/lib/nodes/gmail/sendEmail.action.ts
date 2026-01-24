import { z } from "zod";
import { AutomationNode, NodeContext, OutputField } from "../base";
import { getConnection } from "../../connections/service";
import { resolveTemplate } from "../../execution/templateResolver";

// Config schema for Gmail Send Email action
const configSchema = z.object({
  connectionId: z.string().min(1, "Gmail connection required"),
  to: z.string().min(1, "Recipient email required"),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  subject: z.string().min(1, "Subject required"),
  bodyHtml: z.string().min(1, "Email body required"),
  attachments: z.array(z.string()).optional(),
});

// Output schema
const outputSchema = z.object({
  messageId: z.string(),
  threadId: z.string(),
  status: z.literal("sent"),
  to: z.string(),
  subject: z.string(),
});

type Config = z.infer<typeof configSchema>;

/**
 * Send email via Gmail API
 */
async function sendGmailMessage(
  accessToken: string,
  to: string,
  subject: string,
  bodyHtml: string,
  cc?: string,
  bcc?: string
): Promise<{ messageId: string; threadId: string }> {
  try {
    // Dynamic import for server-side only
    const { google } = await import("googleapis");
    
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Construct MIME message
    const headers = [
      `To: ${to}`,
      cc ? `Cc: ${cc}` : "",
      bcc ? `Bcc: ${bcc}` : "",
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=utf-8",
    ]
      .filter(Boolean)
      .join("\r\n");

    const message = `${headers}\r\n\r\n${bodyHtml}`;
    const encodedMessage = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });

    return {
      messageId: response.data.id || `msg_${Date.now()}`,
      threadId: response.data.threadId || "",
    };
  } catch (error: any) {
    console.error("[Gmail] Failed to send email:", error.message);
    throw new Error(`Gmail API error: ${error.message}`);
  }
}

/**
 * Gmail Send Email Action (REALISTIC)
 * 
 * - Requires Gmail OAuth connection
 * - Supports template strings: {{steps.nodeId.field}}
 * - Resolves templates using previousOutputs from execution context
 * - Sends real emails via Gmail API
 * - Returns message ID and thread ID
 */
export const gmailSendEmailAction: AutomationNode = {
  type: "gmail.action.sendEmail",
  category: "action",
  displayName: "Gmail – Send Email",
  description: "Send an email via Gmail (requires Gmail connection)",
  configSchema,
  outputSchema,

  // Connection requirements
  requiresConnection: true,
  provider: "gmail",

  // Output fields
  outputFields: [
    {
      key: "messageId",
      label: "Message ID",
      type: "string",
      description: "Unique identifier for the sent message",
    },
    {
      key: "threadId",
      label: "Thread ID",
      type: "string",
      description: "Gmail conversation thread ID",
    },
    {
      key: "status",
      label: "Status",
      type: "string",
      description: "Delivery status (always 'sent')",
    },
    {
      key: "to",
      label: "Recipient",
      type: "string",
      description: "Email address of recipient",
    },
    {
      key: "subject",
      label: "Subject",
      type: "string",
      description: "Email subject line",
    },
  ],

  async run(ctx: NodeContext) {
    const cfg = configSchema.parse(ctx.config) as Config;

    // Get Gmail connection
    const connection = await getConnection(cfg.connectionId);
    if (!connection || !connection.accessToken) {
      throw new Error("Gmail connection not found or missing access token");
    }

    // Get previous outputs for template resolution
    const previousOutputs = ctx.previousOutputs || {};

    // Resolve all template strings
    const to = resolveTemplate(cfg.to, previousOutputs);
    const subject = resolveTemplate(cfg.subject, previousOutputs);
    const bodyHtml = resolveTemplate(cfg.bodyHtml, previousOutputs);
    const cc = cfg.cc ? resolveTemplate(cfg.cc, previousOutputs) : undefined;
    const bcc = cfg.bcc ? resolveTemplate(cfg.bcc, previousOutputs) : undefined;

    // Validate resolved values
    if (!to || !to.includes("@")) {
      throw new Error(`Invalid recipient email after template resolution: "${to}"`);
    }

    // Send email via Gmail API
    const result = await sendGmailMessage(
      connection.accessToken,
      to,
      subject,
      bodyHtml,
      cc,
      bcc
    );

    console.log(`[Gmail] Successfully sent email to ${to}: ${subject}`);

    return outputSchema.parse({
      messageId: result.messageId,
      threadId: result.threadId,
      status: "sent" as const,
      to,
      subject,
    });
  },
};
