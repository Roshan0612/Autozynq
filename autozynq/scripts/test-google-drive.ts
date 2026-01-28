import { prisma } from "../lib/prisma";
import { createFolder, setSharingPreference, listFolders } from "../lib/integrations/google/drive";

/**
 * Test Google Drive integration
 * 
 * Usage:
 * npx tsx scripts/test-google-drive.ts
 * 
 * Requires:
 * - Active Google Drive connection in database
 * - Test folder parent ID
 */

async function main() {
  console.log("=== Google Drive Integration Test ===\n");

  // Find a Google Drive connection
  const connection = await prisma.connection.findFirst({
    where: { provider: "google" },
  });

  if (!connection) {
    console.error("❌ No Google connection found. Please connect Google first.");
    process.exit(1);
  }

  const connectionId = connection.id;
  console.log(`✓ Using connection: ${connectionId}`);
  console.log(`  Provider: ${connection.provider}`);
  console.log(`  User: ${connection.userId}\n`);

  try {
    // Test 1: List folders
    console.log("📁 Test 1: Listing folders...");
    const folders = await listFolders(connectionId);
    console.log(`✓ Found ${folders.length} folders`);
    if (folders.length > 0) {
      console.log(`  Sample: ${folders[0].name} (ID: ${folders[0].id})\n`);
    }

    // Test 2: Create a folder
    console.log("📁 Test 2: Creating folder...");
    const testFolderName = `Test Folder ${Date.now()}`;
    const createResult = await createFolder(connectionId, testFolderName);
    console.log("✓ Folder created successfully!");
    console.log(`  ID: ${createResult.folderId}`);
    console.log(`  Name: ${createResult.folderName}`);
    console.log(`  Link: ${createResult.webViewLink}`);
    console.log(`  Owner: ${createResult.ownerEmail}\n`);

    // Test 3: Set sharing preference
    console.log("🔗 Test 3: Setting sharing preference...");
    const shareResult = await setSharingPreference(
      connectionId,
      createResult.folderId,
      "viewer",
      "anyone",
      undefined,
      true
    );
    console.log("✓ Sharing preference set!");
    console.log(`  Permission ID: ${shareResult.permissionId}`);
    console.log(`  Role: ${shareResult.role}`);
    console.log(`  Type: ${shareResult.type}`);
    console.log(`  Link: ${shareResult.webViewLink}\n`);

    console.log("✅ All tests passed!");
  } catch (error: any) {
    console.error("❌ Test failed:");
    console.error(`  Error: ${error.message}`);
    if (error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
