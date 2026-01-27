import { startPollingService } from "../lib/triggers/polling";

/**
 * Standalone polling service for Google Forms triggers.
 * Run this in the background to detect new form submissions.
 * 
 * Usage: npx tsx scripts/start-polling.ts
 */

console.log("=== Google Forms Polling Service ===");
console.log("This service will check for new form responses every 30 seconds.");
console.log("Press Ctrl+C to stop.\n");

// Start polling every 30 seconds
const interval = startPollingService(30000);

// Keep process alive
process.on("SIGINT", () => {
  console.log("\n\n[Polling] Shutting down...");
  clearInterval(interval);
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n\n[Polling] Shutting down...");
  clearInterval(interval);
  process.exit(0);
});
