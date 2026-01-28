# Google Drive Integration

Production-grade Google Drive automation for the workflow platform.

## Architecture

### OAuth Connection
- **Provider**: Google OAuth 2.0
- **Scopes**: `drive`, `drive.file`
- **Shared Connection**: One connection used by all Drive nodes
- **Session**: Tokens auto-refresh before expiration

### Nodes

#### 1. Create Folder
**Type**: `google_drive.action.createFolder`

Creates a new folder in Google Drive with optional parent folder selection.

**Inputs**:
- `connectionId` (required): Google Drive OAuth connection
- `parentFolderId` (optional): Dropdown-selected parent folder ID
- `customParentFolderId` (optional): Manual folder ID (overrides dropdown)
- `folderName` (required): Name for the new folder

**Outputs**:
- `folderId`: Unique folder ID
- `folderName`: Folder name
- `parentId`: ID of parent folder
- `webViewLink`: URL to folder in Google Drive
- `createdTime`: ISO 8601 timestamp
- `ownerEmail`: Owner's email address

**Example Usage**:
```javascript
// In workflow:
// 1. Connect Google Drive account
// 2. Select parent folder or leave empty for root
// 3. Enter folder name
// 4. Folder created and ID available for subsequent nodes
```

#### 2. Set Sharing Preference
**Type**: `google_drive.action.setSharingPreference`

Configure sharing settings for a file or folder.

**Inputs**:
- `connectionId` (required): Google Drive OAuth connection
- `fileId` (required): File or folder ID (typically from previous node)
- `role` (required): Access level
  - `viewer`: Read-only
  - `commenter`: Can add comments
  - `editor`: Full editing rights
- `scope` (required): Who can access
  - `private`: Only specific person
  - `link`: Anyone with the link
  - `anyone`: Public (discoverable)
- `emailAddress` (conditional): Required only when `scope = "private"`
- `allowDiscovery` (optional): Allow discovery in search results (default: true)

**Outputs**:
- `fileId`: File ID
- `permissionId`: Unique permission ID
- `role`: Granted role
- `type`: Permission type (`user` or `anyone`)
- `emailAddress`: Recipient email (null if public)
- `webViewLink`: URL to file/folder

**Example Usage**:
```javascript
// Workflow: Create Folder → Set Sharing Preference
// 1. Create Folder outputs folderId
// 2. Map folderId to fileId in Set Sharing
// 3. Select role "Viewer", scope "Anyone with link"
// 4. Folder now shareable by link
```

## Setup

### 1. Enable Google Drive API
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create or select project
3. Search for "Google Drive API" and enable it
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URI: `{APP_URL}/api/oauth/google/callback`

### 2. Add Drive Scopes to OAuth Flow
Scopes already included in `/api/oauth/google/start/route.ts`:
```typescript
"https://www.googleapis.com/auth/drive",
"https://www.googleapis.com/auth/drive.file",
```

### 3. Connect in Workflow
1. In workflow builder, add "Google Drive" node
2. Click "Connect Google Drive account"
3. Complete OAuth flow
4. Connection stored in database with auto-refresh

## Testing

Run the test script:
```bash
npx tsx scripts/test-google-drive.ts
```

Tests:
1. ✓ List all folders in Drive
2. ✓ Create a test folder
3. ✓ Set sharing to public

## API Routes

### GET `/api/integrations/google-drive/folders`
Lists folders for dropdown picker.

**Query Parameters**:
- `connectionId` (required): OAuth connection ID

**Response**:
```json
{
  "folders": [
    { "id": "...", "name": "My Folder" },
    { "id": "...", "name": "Another Folder" }
  ]
}
```

## Production Behavior

✅ **Real API Calls**: All operations use Google Drive API v3
✅ **Token Management**: Automatic refresh before expiration
✅ **Error Handling**: Descriptive error messages
✅ **Idempotency**: Shared Drive compatible
✅ **Permissions**: Respects OAuth scopes

❌ **No Test Mode**
❌ **No Mock Data**
❌ **No Hardcoded IDs**
❌ **No Sample Responses**

## Security

- OAuth tokens stored encrypted in database
- Refresh tokens persisted for long-term access
- Scope validation on connection
- User isolation (can only access own connections)
- Expires/refreshToken auto-managed

## Troubleshooting

### "Failed to refresh Google access token"
**Fix**: Disconnect and reconnect Google account to obtain fresh token

### "Failed to fetch folders"
**Fix**: Ensure Google Drive API is enabled in Google Cloud project

### "Invalid email address"
**Fix**: When sharing with specific person, enter valid email

### "Permission already exists"
**Note**: Setting same permission twice is idempotent (no duplicate created)

## Future Enhancements

- [ ] Upload file node
- [ ] Move file/folder node
- [ ] Delete file/folder node
- [ ] Update file metadata node
- [ ] Search files node
- [ ] Shared Drives support (already compatible)
- [ ] Team Drives listing
