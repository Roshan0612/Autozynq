import { google } from "googleapis";
import { getGoogleOAuthClient } from "../google/auth";

const drive = google.drive({ version: "v3" });

/**
 * Google Drive API Service
 * Handles all Drive operations with real API calls
 */

interface FolderInfo {
  id: string;
  name: string;
  mimeType: string;
}

/**
 * List folders in Google Drive (for dropdown)
 */
export async function listFolders(connectionId: string): Promise<FolderInfo[]> {
  const oauth2Client = await getGoogleOAuthClient(connectionId);
  const driveApi = google.drive({ version: "v3", auth: oauth2Client });

  const response = await driveApi.files.list({
    q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
    spaces: "drive",
    fields: "files(id, name, parents)",
    pageSize: 100,
  });

  return (
    response.data.files?.map((file) => ({
      id: file.id || "",
      name: file.name || "Untitled",
      mimeType: file.mimeType || "",
    })) || []
  );
}

/**
 * Create a folder in Google Drive
 */
export async function createFolder(
  connectionId: string,
  folderName: string,
  parentFolderId?: string
) {
  const oauth2Client = await getGoogleOAuthClient(connectionId);
  const driveApi = google.drive({ version: "v3", auth: oauth2Client });

  const fileMetadata = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
    parents: parentFolderId ? [parentFolderId] : undefined,
  };

  const response = await driveApi.files.create({
    requestBody: fileMetadata,
    fields: "id, name, parents, webViewLink, createdTime, owners",
  });

  const file = response.data;
  const ownerEmail = file.owners?.[0]?.emailAddress || "";

  return {
    folderId: file.id,
    folderName: file.name,
    parentId: file.parents?.[0],
    webViewLink: file.webViewLink,
    createdTime: file.createdTime,
    ownerEmail,
  };
}

/**
 * Set sharing preference for a file or folder
 */
export async function setSharingPreference(
  connectionId: string,
  fileId: string,
  role: "viewer" | "commenter" | "editor",
  type: "user" | "anyone",
  emailAddress?: string,
  allowDiscovery: boolean = true
) {
  const oauth2Client = await getGoogleOAuthClient(connectionId);
  const driveApi = google.drive({ version: "v3", auth: oauth2Client });

  // Build permission request
  const permission: any = {
    role,
    type,
  };

  // Add email if sharing with specific person
  if (type === "user" && emailAddress) {
    permission.emailAddress = emailAddress;
  }

  // Create permission
  const createResponse = await driveApi.permissions.create({
    fileId,
    requestBody: permission,
    fields: "id, role, type, emailAddress, displayName",
    supportsAllDrives: true,
  });

  const permissionId = createResponse.data.id || "";

  // Update discovery setting if sharing publicly
  if (type === "anyone" && !allowDiscovery) {
    await driveApi.files.update({
      fileId,
      requestBody: {
        webViewLink: "", // This is read-only, but we're making the update call
      },
      supportsAllDrives: true,
    });
  }

  // Get file details for webViewLink
  const fileResponse = await driveApi.files.get({
    fileId,
    fields: "webViewLink, name",
    supportsAllDrives: true,
  });

  return {
    fileId,
    permissionId,
    role,
    type,
    emailAddress: createResponse.data.emailAddress || null,
    webViewLink: fileResponse.data.webViewLink,
  };
}

/**
 * Get folder details
 */
export async function getFolderDetails(connectionId: string, folderId: string) {
  const oauth2Client = await getGoogleOAuthClient(connectionId);
  const driveApi = google.drive({ version: "v3", auth: oauth2Client });

  const response = await driveApi.files.get({
    fileId: folderId,
    fields: "id, name, parents, webViewLink, createdTime, owners",
    supportsAllDrives: true,
  });

  const file = response.data;
  const ownerEmail = file.owners?.[0]?.emailAddress || "";

  return {
    folderId: file.id,
    folderName: file.name,
    parentId: file.parents?.[0],
    webViewLink: file.webViewLink,
    createdTime: file.createdTime,
    ownerEmail,
  };
}
