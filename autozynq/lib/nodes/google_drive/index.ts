import { googleDriveCreateFolderAction } from "./createFolder.action";
import { googleDriveSetSharingPreferenceAction } from "./setSharingPreference.action";

export const googleDriveNodes = {
  [googleDriveCreateFolderAction.type]: googleDriveCreateFolderAction,
  [googleDriveSetSharingPreferenceAction.type]: googleDriveSetSharingPreferenceAction,
};
