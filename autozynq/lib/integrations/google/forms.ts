/* eslint-disable @typescript-eslint/no-explicit-any */
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { getGoogleOAuthClient, connectionHasScopes } from "./auth";
import { OAuthScopeError } from "@/lib/errors";

export async function listUserForms(userId: string, connectionId?: string) {
  const connection = await getUserGoogleConnection(userId, connectionId);
  const requiredScopes = [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/forms.body.readonly",
  ];
  const grantedScope = (connection.metadata as any)?.scope as string | undefined;
  if (!connectionHasScopes(grantedScope, requiredScopes)) {
    // Mark connection as needing reauth
    await prisma.connection.update({
      where: { id: connection.id },
      data: {
        metadata: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(connection.metadata as any) || {},
          needsReauth: true,
        },
      },
    });
    throw new OAuthScopeError("Insufficient Google scopes for listing forms", requiredScopes);
  }
  const auth = await getGoogleOAuthClient(connection.id);
  const drive = google.drive({ version: "v3", auth });

  const resp = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.form'",
    spaces: "drive",
    fields: "files(id,name,createdTime,description)",
    pageSize: 100,
    orderBy: "createdTime desc",
  });

  return (resp.data.files || []).map((f) => ({
    id: f.id!,
    // Provide both for compatibility with existing UI components
    name: f.name!,
    title: f.name!,
    createdTime: f.createdTime!,
    description: f.description || null,
  }));
}

export async function getFormSchema(connectionId: string, formId: string) {
  const auth = await getGoogleOAuthClient(connectionId);
  const forms = google.forms({ version: "v1", auth });
  const resp = await forms.forms.get({ formId });
  const form = resp.data;
  const items = form.items || [];
  const questions = items
    .filter((it) => it.questionItem)
    .map((it) => {
      const question = it.questionItem!.question!;
      // Use questionId because responses key answers by questionId, not itemId
      const questionId = question.questionId || it.itemId!;
      return {
        id: questionId,
        title: it.title || "Untitled",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: (question as any).questionType || "TEXT",
      };
    });
  
  console.log("[Forms] getFormSchema - Retrieved questions:", questions);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { formId, title: (form as any).title || "Untitled Form", questions };
}

export async function listNewResponses(connectionId: string, formId: string, lastResponseId?: string) {
  const auth = await getGoogleOAuthClient(connectionId);
  const forms = google.forms({ version: "v1", auth });

  const resp = await forms.forms.responses.list({ formId, pageSize: 50 });
  const responses = resp.data.responses || [];

  console.log(`[Forms] listNewResponses - Found ${responses.length} total responses`);
  console.log(`[Forms] listNewResponses - lastResponseId: ${lastResponseId || "NULL (first poll)"}`);

  // If we have lastResponseId, only keep newer ones (assuming API returns newest first)
  const newOnes = [] as typeof responses;
  for (const r of responses) {
    if (!lastResponseId || r.responseId !== lastResponseId) {
      newOnes.push(r);
    } else {
      break; // stop at last seen
    }
  }

  console.log(`[Forms] listNewResponses - Returning ${newOnes.length} new response(s)`);
  return newOnes;
}

/**
 * Fetch the latest responseId without processing historical data.
 * Used to seed lastResponseId when creating/activating triggers.
 */
export async function getLatestResponseId(connectionId: string, formId: string): Promise<string | null> {
  const auth = await getGoogleOAuthClient(connectionId);
  const forms = google.forms({ version: "v1", auth });
  const resp = await forms.forms.responses.list({ formId, pageSize: 1 });
  const responses = resp.data.responses || [];
  if (responses.length === 0) return null;
  return responses[0].responseId || null;
}

export function normalizeAnswers(schema: { questions: Array<{ id: string; title: string }> }, response: any) {
  const answersObj: Record<string, string> = {};
  const answers = response.answers || {};
  // Map questionId -> title
  const titleById = new Map(schema.questions.map((q) => [q.id, q.title]));

  console.log("[Forms] normalizeAnswers - Schema questions:", schema.questions);
  console.log("[Forms] normalizeAnswers - Response answer keys:", Object.keys(answers));
  console.log("[Forms] normalizeAnswers - titleById map:", Array.from(titleById.entries()));

  for (const [questionId, ans] of Object.entries<any>(answers)) {
    const title = titleById.get(questionId) || questionId;
    // Text answers may have array of answers
    let value = "";
    if (ans.textAnswers?.answers?.length) {
      value = ans.textAnswers.answers.map((a: any) => a.value).join(", ");
    } else if (ans.fileUploadAnswers?.answers?.length) {
      value = ans.fileUploadAnswers.answers.map((a: any) => a.fileId || a.fileName).join(", ");
    } else if (ans.dateAnswers?.answers?.length) {
      value = ans.dateAnswers.answers.map((a: any) => a.value).join(", ");
    } else if (ans.choiceAnswers?.answers?.length) {
      value = ans.choiceAnswers.answers.map((a: any) => a.value).join(", ");
    }
    console.log(`[Forms] Mapped questionId=${questionId} -> title=${title}, value=${value}`);
    answersObj[title] = value;
  }

  console.log("[Forms] Final normalized answers:", answersObj);
  return answersObj;
}

async function getUserGoogleConnection(userId: string, connectionId?: string) {
  if (connectionId) {
    const conn = await prisma.connection.findUnique({ where: { id: connectionId } });
    if (!conn) throw new Error(`Connection not found: ${connectionId}`);
    return conn;
  }
  // fallback: latest Google connection for user
  const conn = await prisma.connection.findFirst({
    where: { userId, provider: "google" },
    orderBy: { createdAt: "desc" },
  });
  if (!conn) throw new Error(`No Google connection for user: ${userId}`);
  return conn;
}
