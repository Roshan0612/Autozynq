/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { z } from "zod";
import type { AutomationNode } from "../base";
import { setSharingPreference } from "@/lib/integrations/google/drive";

const configSchema = z.object({
  connectionId: z.string().min(1, "Google Drive connection is required"),
  fileId: z.string().min(1, "File or folder ID is required"),
  role: z.enum(["viewer", "commenter", "editor"]),
  scope: z.enum(["private", "link", "anyone"]),
  emailAddress: z.string().optional(),
  allowDiscovery: z.boolean().default(true),
});

type Config = z.infer<typeof configSchema>;

const outputSchema = z.object({
  fileId: z.string(),
  permissionId: z.string(),
  role: z.string(),
  type: z.string(),
  emailAddress: z.string().nullable(),
  webViewLink: z.string(),
});

export const googleDriveSetSharingPreferenceAction: AutomationNode = {
  type: "google_drive.action.setSharingPreference",
  category: "action",
  displayName: "Google Drive – Set Sharing Preference",
  description: "Configure sharing settings for a file or folder",
  icon: "share-2",
  app: "Google Drive",
  requiresConnection: true,
  provider: "google",
  configSchema,
  outputSchema,
  outputFields: [
    { key: "fileId", label: "File ID", type: "string", description: "ID of the file or folder" },
    { key: "permissionId", label: "Permission ID", type: "string", description: "Unique permission ID" },
    { key: "role", label: "Role", type: "string", description: "Viewer, Commenter, or Editor" },
    { key: "type", label: "Type", type: "string", description: "user or anyone" },
    { key: "emailAddress", label: "Email Address", type: "string", description: "Recipient email if applicable" },
    { key: "webViewLink", label: "File Link", type: "string", description: "Link to the file in Google Drive" },
  ],

  async run(ctx) {
    const config = configSchema.parse(ctx.config);

    // Validate email if scope is "person"
    if (config.scope === "private" && config.emailAddress) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(config.emailAddress)) {
        throw new Error("Invalid email address");
      }
    }

    // Map scope to type
    const typeMap = {
      private: "user" as const,
      link: "anyone" as const,
      anyone: "anyone" as const,
    };

    const type = typeMap[config.scope];

    const result = await setSharingPreference(
      config.connectionId,
      config.fileId,
      config.role,
      type,
      config.emailAddress,
      config.allowDiscovery
    );

    return result;
  },
};
