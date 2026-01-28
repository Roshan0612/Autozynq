import { z } from "zod";
import type { AutomationNode } from "../base";
import { createFolder } from "@/lib/integrations/google/drive";

const configSchema = z.object({
  connectionId: z.string().min(1, "Google Drive connection is required"),
  parentFolderId: z.string().optional(),
  customParentFolderId: z.string().optional(),
  folderName: z.string().min(1, "Folder name is required"),
});

type Config = z.infer<typeof configSchema>;

const outputSchema = z.object({
  folderId: z.string(),
  folderName: z.string(),
  parentId: z.string().optional(),
  webViewLink: z.string(),
  createdTime: z.string(),
  ownerEmail: z.string(),
});

export const googleDriveCreateFolderAction: AutomationNode = {
  type: "google_drive.action.createFolder",
  category: "action",
  displayName: "Google Drive – Create Folder",
  description: "Create a new folder in Google Drive",
  icon: "folder-plus",
  app: "Google Drive",
  requiresConnection: true,
  provider: "google",
  configSchema,
  outputSchema,
  outputFields: [
    { key: "folderId", label: "Folder ID", type: "string", description: "Unique ID of the created folder" },
    { key: "folderName", label: "Folder Name", type: "string", description: "Name of the created folder" },
    { key: "parentId", label: "Parent Folder ID", type: "string", description: "ID of the parent folder" },
    { key: "webViewLink", label: "Folder Link", type: "string", description: "Link to the folder in Google Drive" },
    { key: "createdTime", label: "Created Time", type: "string", description: "ISO 8601 timestamp of creation" },
    { key: "ownerEmail", label: "Owner Email", type: "string", description: "Email of the folder owner" },
  ],

  async run(ctx) {
    const config = configSchema.parse(ctx.config);

    // Determine parent folder ID (custom overrides dropdown)
    // "root" is treated as My Drive (no parent)
    let parentId = config.customParentFolderId || config.parentFolderId || undefined;
    if (parentId === "root") {
      parentId = undefined;
    }

    const result = await createFolder(config.connectionId, config.folderName, parentId);

    return result;
  },
};
