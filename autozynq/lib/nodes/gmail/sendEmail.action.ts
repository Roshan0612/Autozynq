import { z } from "zod";
import { AutomationNode, NodeContext, OutputField } from "../base";
import { getConnection, updateConnection } from "../../connections/service";
import { resolveTemplate } from "../../execution/templateResolver";
import { getGoogleOAuthClient } from "@/lib/integrations/google/auth";
import { OAuthExpiredError } from "@/lib/errors";

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
  oauth2Client: any,
  to: string,
  subject: string,
  bodyHtml: string,
  cc?: string,
  bcc?: string
): Promise<{ messageId: string; threadId: string }> {
  try {
    // Dynamic import for server-side only
    const { google } = await import("googleapis");
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
    // Map invalid credentials to typed error
    if (
      typeof error.message === "string" &&
      error.message.toLowerCase().includes("invalid authentication")
    ) {
      throw new OAuthExpiredError("Google connection expired or invalid. Please reconnect Gmail.");
    }
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
    // Parse config defensively to support manual Execute with incomplete templates
    const cfgResult = configSchema.safeParse(ctx.config);
    let cfg: Config;
    if (!cfgResult.success) {
      console.warn("[Gmail] Config invalid - using test defaults for manual execution", cfgResult.error?.errors);
      const raw = (ctx.config || {}) as any;
      cfg = {
        connectionId: raw.connectionId || "",
        to: raw.to || "test@example.com",
        subject: raw.subject || "Test Email",
        bodyHtml: raw.bodyHtml || "<p>This is a test email generated during manual execution.</p>",
        cc: raw.cc,
        bcc: raw.bcc,
        attachments: raw.attachments,
      } as Config;
    } else {
      cfg = cfgResult.data as Config;
    }

    // Get Gmail connection
    const connection = await getConnection(cfg.connectionId);
    if (!connection || (!connection.accessToken && !connection.refreshToken)) {
      throw new Error("Gmail connection not found or missing credentials");
    }

    // Get previous outputs for template resolution
    const previousOutputs = ctx.previousOutputs || {};

    // Resolve all template strings
    let to = resolveTemplate(cfg.to, previousOutputs);
    let subject = resolveTemplate(cfg.subject, previousOutputs);
    let bodyHtml = resolveTemplate(cfg.bodyHtml, previousOutputs);
    const cc = cfg.cc ? resolveTemplate(cfg.cc, previousOutputs) : undefined;
    const bcc = cfg.bcc ? resolveTemplate(cfg.bcc, previousOutputs) : undefined;

    // Fallbacks for manual test when templates resolve to empty
    if (!to) {
      to = "test@example.com";
      console.warn("[Gmail] 'to' resolved empty - using test@example.com for manual execution");
    }
    if (!subject) {
      subject = "New Form Submission (Test)";
    }
    if (!bodyHtml) {
      bodyHtml = "<h2>New Form Submission</h2><p>This is a test message sent during manual execution.</p>";
    }

    // Validate resolved values
    if (!to || !to.includes("@")) {
      throw new Error(`Invalid recipient email after template resolution: "${to}"`);
    }
    // Refresh token and send email via Gmail API using unified auth client
    const oauth2Client = await getGoogleOAuthClient(connection.id);
    let result: { messageId: string; threadId: string };
    try {
      result = await sendGmailMessage(
        oauth2Client,
        to,
        subject,
        bodyHtml,
        cc,
        bcc
      );
    } catch (err) {
      if (err instanceof OAuthExpiredError) {
        // Mark connection invalid for UX guardrails
        await updateConnection(connection.id, {
          metadata: {
            ...(connection.metadata || {}),
            needsReauth: true,
          },
        });
        // Re-throw typed error to be handled by engine without 500s
        throw err;
      }
      throw err;
    }

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
