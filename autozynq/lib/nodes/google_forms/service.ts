/**
 * Google Forms Service
 * 
 * Handles:
 * 1. Listing available Google Forms for a user
 * 2. Getting form schema (questions)
 * 3. Programmatic trigger installation (in future versions)
 * 
 * Uses Google OAuth credentials stored in Connection records
 */

import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

/**
 * Initialize Google Forms API client with user's OAuth token
 */
async function getFormsClient(connectionId: string) {
  const connection = await prisma.connection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    throw new Error(`Connection not found: ${connectionId}`);
  }

  if (connection.provider !== "google") {
    throw new Error(`Connection is not a Google connection: ${connectionId}`);
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/oauth/google/callback`
  );

  // Set credentials from stored tokens
  oauth2Client.setCredentials({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken || undefined,
    expiry_date: connection.expiresAt?.getTime(),
  });

  return {
    client: oauth2Client,
    forms: google.forms({ version: "v1", auth: oauth2Client }),
  };
}

/**
 * List all forms accessible to the user
 * 
 * Returns: { formId, title, description, createdTime }
 */
export async function listForms(connectionId: string) {
  try {
    const { forms } = await getFormsClient(connectionId);

    // Get Drive API to list forms
    const drive = google.drive({ version: "v3", auth: forms.context._options.auth });
    
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.form'",
      spaces: "drive",
      fields: "files(id, name, description, createdTime)",
      pageSize: 50,
    });

    return response.data.files || [];
  } catch (error) {
    console.error("Error listing forms:", error);
    throw new Error(`Failed to list Google Forms: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Get form schema (all questions and their types)
 * 
 * Returns: { questions: [{ id, title, type, required }], formId, title }
 */
export async function getFormSchema(connectionId: string, formId: string) {
  try {
    const { forms } = await getFormsClient(connectionId);

    const response = await forms.forms.get({
      formId,
    });

    const form = response.data;

    if (!form || !form.items) {
      return {
        formId,
        title: form?.title || "Unknown Form",
        questions: [],
      };
    }

    // Extract questions from form items
    const questions = form.items
      .filter((item) => item.questionItem) // Only question items, not sections
      .map((item) => ({
        id: item.itemId,
        title: item.title || "Untitled Question",
        type: item.questionItem?.question?.questionType || "TEXT",
        required: item.questionItem?.question?.required || false,
      }));

    return {
      formId,
      title: form.title || "Untitled Form",
      questions,
    };
  } catch (error) {
    console.error("Error getting form schema:", error);
    throw new Error(
      `Failed to get form schema: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Format form schema as output fields for the trigger node
 * 
 * Output format: answers.fieldName
 */
export function formatFormAsOutputFields(schema: {
  formId: string;
  title: string;
  questions: Array<{ id: string; title: string; type: string }>;
}) {
  return [
    {
      name: "eventId",
      type: "string" as const,
      description: "Unique event identifier (for idempotency)",
    },
    {
      name: "formId",
      type: "string" as const,
      description: "Google Form ID",
    },
    {
      name: "responseId",
      type: "string" as const,
      description: "Unique form response ID",
    },
    {
      name: "submittedAt",
      type: "string" as const,
      description: "Timestamp of form submission (ISO 8601)",
    },
    {
      name: "respondentEmail",
      type: "string" as const,
      description: "Email of form respondent (if available)",
    },
    // Dynamic answers from form questions
    ...schema.questions.map((q) => ({
      name: `answers.${q.title}`,
      type: "string" as const,
      description: `Answer to: ${q.title}`,
    })),
  ];
}

/**
 * Get trigger installation status for a form
 * Checks if the form has the webhook trigger installed
 * 
 * Returns: { isInstalled: boolean, triggerId?: string }
 */
export async function checkTriggerInstalled(formId: string) {
  try {
    // In the current implementation, we rely on form description containing triggerId
    // In a more advanced version, this would check Apps Script project settings
    // For now, just return that it's ready for installation
    
    return {
      isInstalled: false, // Will be true after user installs Apps Script
      triggerId: undefined,
    };
  } catch (error) {
    console.error("Error checking trigger status:", error);
    return {
      isInstalled: false,
      triggerId: undefined,
    };
  }
}
