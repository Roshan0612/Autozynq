/**
 * Google Apps Script: Drive Bridge (polling)
 *
 * Use this script when you cannot enable Drive push notifications.
 * It runs on a time-driven trigger and POSTs new/updated files to your webhook.
 *
 * Usage:
 * 1. Copy this file into the Script Editor for a Google Workspace project.
 * 2. Set `WEBHOOK_BASE_URL` and `WEBHOOK_SECRET` below.
 * 3. Optional: set a `FOLDER_ID` to monitor a specific folder.
 * 4. Run `installDriveTrigger()` once and authorize the script.
 */

const WEBHOOK_BASE_URL = "https://your-app.example.com/api/webhooks/"; // include trailing slash
const WEBHOOK_SECRET =
  PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET") ||
  "replace-me";
const FOLDER_ID = ""; // optional folder id to scope polling

function installDriveTrigger() {
  // create a time-driven trigger to run every 5 minutes
  ScriptApp.newTrigger("drivePoller").timeBased().everyMinutes(5).create();
  Logger.log("Drive poller trigger installed");
}

function drivePoller() {
  const props = PropertiesService.getScriptProperties();
  const lastSeenIso =
    props.getProperty("lastSeen") || new Date(0).toISOString();
  const lastSeen = new Date(lastSeenIso);

  let files = [];
  if (FOLDER_ID) {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const iter = folder.getFiles();
    while (iter.hasNext()) files.push(iter.next());
  } else {
    const iter = DriveApp.getFiles();
    while (iter.hasNext()) files.push(iter.next());
  }

  const newEvents = [];
  files.forEach((file) => {
    try {
      const updated = new Date(file.getLastUpdated());
      if (updated > lastSeen) {
        newEvents.push({
          eventId: file.getId() + ":" + updated.getTime(),
          fileId: file.getId(),
          fileName: file.getName(),
          mimeType: file.getMimeType(),
          changeType: "updated",
          changedAt: updated.toISOString(),
          owners: file
            .getOwners()
            .map((o) => (o.getEmail && o.getEmail ? o.getEmail() : "")),
        });
      }
    } catch (e) {
      // ignore permission errors
      Logger.log("Drive poller error: " + e);
    }
  });

  if (newEvents.length === 0) return;

  // For each event, post to the webhook base URL + triggerPath configured by user
  // The user must set the trigger path in Script Properties as 'triggerPath'
  const triggerPath = props.getProperty("triggerPath");
  if (!triggerPath) {
    Logger.log(
      "No triggerPath configured in Script Properties. Set triggerPath to the subscription webhook path.",
    );
    return;
  }

  const url = WEBHOOK_BASE_URL + encodeURIComponent(triggerPath);
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ events: newEvents }),
    headers: {
      "X-Signature": computeHmac(JSON.stringify({ events: newEvents })),
    },
    muteHttpExceptions: true,
  };

  try {
    const resp = UrlFetchApp.fetch(url, options);
    Logger.log(
      "Posted " +
        newEvents.length +
        " events; response: " +
        resp.getResponseCode(),
    );
    // update lastSeen to latest changedAt
    const latest = newEvents.reduce((a, b) =>
      a.changedAt > b.changedAt ? a : b,
    );
    props.setProperty("lastSeen", latest.changedAt);
  } catch (err) {
    Logger.log("Failed to post drive events: " + err);
  }
}

function computeHmac(payload) {
  // Simple HMAC with secret configured in script properties
  const key =
    WEBHOOK_SECRET ||
    PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET") ||
    "secret";
  const signature = Utilities.computeHmacSha256Signature(payload, key);
  // Utilities returns bytes; convert to hex
  return signature
    .map(function (b) {
      var v = b < 0 ? b + 256 : b;
      return ("0" + v.toString(16)).slice(-2);
    })
    .join("");
}
