import { z } from "zod";
import type { AutomationNode, NodeContext, OutputField } from "../base";
import { getConnection } from "../../connections/service";

// Config schema for Google Forms New Response Trigger
const configSchema = z.object({
  connectionId: z.string().min(1, "Google connection required"),
  formId: z.string().min(1, "Form ID required"),
  includeAttachments: z.boolean().default(false),
  conditions: z
    .array(
      z.object({
        field: z.string(),
        operator: z.enum(["equals", "contains", "exists"]),
        value: z.string().optional(),
      })
    )
    .optional(),
});

// Output schema: normalized response data from webhook payload
const outputSchema = z.object({
  responseId: z.string(),
  submittedAt: z.string(),
  formTitle: z.string(),
  // Dynamic fields will be added based on form structure
});

type Config = z.infer<typeof configSchema>;

/**
 * Fetch form structure from Google Forms API
 * Returns the form metadata including question titles
 */
async function getFormStructure(
  formId: string,
  accessToken: string
): Promise<{ title: string; questions: Array<{ questionId: string; title: string; type: string }> }> {
  try {
    const { google } = await import("googleapis");
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const forms = google.forms({ version: "v1", auth: oauth2Client });
    const response = await forms.forms.get({ formId });

    const formTitle = response.data.info?.title || "Untitled Form";
    const items = response.data.items || [];

    const questions = items
      .filter((item) => item.questionItem)
      .map((item) => {
        const questionItem = item.questionItem!;
        const question = questionItem.question!;
        return {
          questionId: question.questionId || "",
          title: item.title || "Untitled Question",
          type:
            question.choiceQuestion ? "choice" :
            question.textQuestion ? "text" :
            question.scaleQuestion ? "scale" :
            question.dateQuestion ? "date" :
            question.timeQuestion ? "time" :
            question.fileUploadQuestion ? "file" :
            "unknown",
        };
      });

    return { title: formTitle, questions };
  } catch (error: any) {
    console.error("[GoogleForms] Failed to fetch form structure:", error.message);
    // Return minimal structure if API call fails
    return {
      title: "Unknown Form",
      questions: [],
    };
  }
}

/**
 * Google Forms New Response Trigger (REALISTIC)
 * 
 * - Requires Google OAuth connection
 * - Fetches actual form structure from Google Forms API
 * - Generates dynamic output fields based on form questions
 * - Triggered via existing webhook infrastructure
 * - Normalizes webhook payload to match form structure
 */
export const googleFormsNewResponseTrigger: AutomationNode = {
  type: "google_forms.trigger.newResponse",
  category: "trigger",
  displayName: "Google Forms – New Response",
  description: "Trigger on new Google Form responses (requires Google connection)",
  configSchema,
  outputSchema,

  // Connection requirements
  requiresConnection: true,
  provider: "google",

  // Static output fields (always present)
  outputFields: [
    {
      key: "responseId",
      label: "Response ID",
      type: "string",
      description: "Unique identifier for this form response",
    },
    {
      key: "submittedAt",
      label: "Submitted At",
      type: "string",
      description: "ISO timestamp when the form was submitted",
    },
    {
      key: "formTitle",
      label: "Form Title",
      type: "string",
      description: "Title of the Google Form",
    },
  ],

  // Dynamic output fields (fetched from Google Forms API)
  async getDynamicOutputFields(config: unknown, userId: string): Promise<OutputField[]> {
    try {
      const cfg = configSchema.parse(config);

      // Get Google connection
      const connection = await getConnection(cfg.connectionId);
      if (!connection || connection.userId !== userId) {
        console.warn("[GoogleForms] Connection not found or unauthorized");
        return [];
      }

      if (!connection.accessToken) {
        console.warn("[GoogleForms] Connection missing access token");
        return [];
      }

      // Fetch form structure
      const formStructure = await getFormStructure(cfg.formId, connection.accessToken);

      // Generate OutputFields from form questions
      return formStructure.questions.map((q) => ({
        key: q.questionId || q.title.toLowerCase().replace(/\s+/g, "_"),
        label: q.title,
        type: q.type === "scale" ? "number" : "string",
        description: `Answer to: ${q.title}`,
      }));
    } catch (error: any) {
      console.error("[GoogleForms] Failed to get dynamic fields:", error.message);
      return [];
    }
  },

  async run(ctx: NodeContext) {
    const cfg = configSchema.parse(ctx.config) as Config;

    // Get connection for API access
    const connection = await getConnection(cfg.connectionId);
    if (!connection || !connection.accessToken) {
      throw new Error("Google connection not found or missing access token");
    }

    // Input is the raw webhook payload
    const payload = ctx.input as any || {};

    // Extract response data from payload
    const responseId = payload.responseId || `resp_${Date.now()}`;
    const submittedAt = payload.timestamp || new Date().toISOString();
    const answers = payload.answers || {};

    // Fetch form structure to get form title and normalize answers
    const formStructure = await getFormStructure(cfg.formId, connection.accessToken);

    // Build output object with static + dynamic fields
    const output: Record<string, any> = {
      responseId,
      submittedAt,
      formTitle: formStructure.title,
    };

    // Map webhook answers to question IDs/titles
    for (const question of formStructure.questions) {
      const fieldKey = question.questionId || question.title.toLowerCase().replace(/\s+/g, "_");
      output[fieldKey] = answers[fieldKey] || answers[question.title] || "";
    }

    // Apply optional conditions filter
    if (cfg.conditions && cfg.conditions.length > 0) {
      for (const condition of cfg.conditions) {
        const fieldValue = output[condition.field];

        if (condition.operator === "exists") {
          if (!fieldValue) {
            throw new Error(`Condition failed: field '${condition.field}' does not exist`);
          }
        } else if (condition.operator === "equals") {
          if (fieldValue !== condition.value) {
            throw new Error(`Condition failed: field '${condition.field}' does not equal '${condition.value}'`);
          }
        } else if (condition.operator === "contains") {
          const fieldStr = String(fieldValue || "");
          if (!fieldStr.includes(String(condition.value || ""))) {
            throw new Error(`Condition failed: field '${condition.field}' does not contain '${condition.value}'`);
          }
        }
      }
    }

    return output;
  },
};
