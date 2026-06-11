/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import type { AutomationNode, NodeContext, OutputField } from "../base";
import { prisma } from "@/lib/prisma";

const configSchema = z.object({
  connectionId: z.string().min(1, "Google connection required"),
  folderId: z.string().optional(),
  // If folderId omitted, monitor entire Drive (Apps Script poll may be scoped)
});

type Config = z.infer<typeof configSchema>;

const outputSchema = z.object({
  eventId: z.string().optional(),
  fileId: z.string(),
  fileName: z.string(),
  mimeType: z.string().optional(),
  changeType: z.string().optional(),
  changedAt: z.string().optional(),
  owners: z.array(z.string()).optional(),
});

export const googleDriveWatchChangesTrigger: AutomationNode = {
  type: "google_drive.trigger.watchChanges",
  category: "trigger",
  app: "Google Drive",
  displayName: "Google Drive – File Changes",
  description: "Trigger when files are created or changed in Drive (via Apps Script bridge)",
  configSchema,
  outputSchema,

  requiresConnection: true,
  provider: "google",

  outputFields: [
    { key: "eventId", label: "Event ID", type: "string", description: "Idempotency key for the event" },
    { key: "fileId", label: "File ID", type: "string", description: "Google Drive file ID" },
    { key: "fileName", label: "File Name", type: "string", description: "Name of the file" },
    { key: "mimeType", label: "MIME Type", type: "string", description: "MIME type of the file" },
    { key: "changeType", label: "Change Type", type: "string", description: "create/update/delete" },
    { key: "changedAt", label: "Changed At", type: "string", description: "ISO timestamp of change" },
  ],

  async getDynamicOutputFields(_config: unknown, _userId: string) {
    return [] as OutputField[];
  },

  async run(ctx: NodeContext) {
    const payload = (ctx.input || {}) as Record<string, unknown>;
    const cfgResult = configSchema.safeParse(ctx.config);
    const cfg: Partial<Config> = cfgResult.success ? cfgResult.data : {};

    // Expect payload provided by Apps Script bridge: { eventId, fileId, fileName, mimeType, changeType, changedAt }
    const hasRealPayload = Boolean(payload.fileId && payload.fileName);
    if (!hasRealPayload) {
      throw new Error("Trigger has not received a Drive file event yet");
    }

    return {
      eventId: typeof payload.eventId === "string" ? payload.eventId : undefined,
      fileId: String(payload.fileId),
      fileName: typeof payload.fileName === "string" ? payload.fileName : String(payload.fileId),
      mimeType: typeof payload.mimeType === "string" ? payload.mimeType : undefined,
      changeType: typeof payload.changeType === "string" ? payload.changeType : undefined,
      changedAt: typeof payload.changedAt === "string" ? payload.changedAt : new Date().toISOString(),
      owners: Array.isArray(payload.owners) ? (payload.owners as string[]) : undefined,
    };
  },
};
