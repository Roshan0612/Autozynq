/**
 * Autozynq Google Forms Webhook Bridge
 *
 * Deploy this as a Google Apps Script Web App (Execute as: Me, Who has access: Anyone)
 *
 * Usage:
 * 1. Deploy this script as a Web App
 * 2. Set WEBHOOK_BASE_URL and WEBHOOK_SECRET
 * 3. In your Google Form, open Script Editor
 * 4. Add this trigger installer code (see below)
 * 5. Run installTrigger() once
 * 6. Script will auto-fire onFormSubmit() for each form response
 *
 * The script forwards form responses to: https://yourapp.com/api/webhooks/[triggerId]
 */

// ============================================================================
// CONFIGURATION (Set these in your standalone Apps Script project)
// ============================================================================

const WEBHOOK_BASE_URL = "http://localhost:3000"; // Your Autozynq app URL
const WEBHOOK_SECRET = "your-shared-secret-key"; // Must match GOOGLE_FORMS_WEBHOOK_SECRET in .env

// ============================================================================
// FORM SUBMISSION HANDLER
// ============================================================================

/**
 * Triggered when a form is submitted
 * Sends webhook to Autozynq with form response data
 */
function onFormSubmit(e) {
  try {
    const formResponse = e.response;
    const form = formResponse.getPageItems()[0]?.getParent();

    if (!form) {
      console.error("Could not get form");
      return;
    }

    // Extract trigger ID from form metadata
    const triggerId = form.getDescription().match(/triggerId:(\w+)/)?.[1];
    if (!triggerId) {
      console.log("No triggerId in form description. Skipping webhook.");
      return;
    }

    // Collect all responses
    const itemResponses = formResponse.getItemResponses();
    const answers = {};

    itemResponses.forEach((itemResponse) => {
      const question = itemResponse.getItem().getTitle();
      const answer = itemResponse.getResponse();
      answers[question] = answer;
    });

    // Build webhook payload
    const payload = {
      eventId: Utilities.getUuid(), // Unique identifier for idempotency
      formId: form.getId(),
      responseId: formResponse.getId(),
      answers: answers,
      submittedAt: new Date().toISOString(),
      respondentEmail: formResponse.getRespondentEmail(),
    };

    // Create signature for verification
    const signature = Utilities.computeHmacSha256Signature(
      JSON.stringify(payload),
      WEBHOOK_SECRET,
    );
    const signatureHex = signature
      .map((b) => ("0" + (b & 0xff).toString(16)).slice(-2))
      .join("");

    // Send webhook
    const webhookUrl = `${WEBHOOK_BASE_URL}/api/webhooks/${triggerId}`;
    const options = {
      method: "post",
      contentType: "application/json",
      headers: {
        "X-Signature": signatureHex,
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(webhookUrl, options);
    console.log(
      `[Webhook] Sent to ${triggerId}: ${response.getResponseCode()}`,
    );
  } catch (error) {
    console.error("[Webhook] Error:", error);
  }
}

// ============================================================================
// TRIGGER INSTALLATION
// ============================================================================

/**
 * Install the onFormSubmit trigger
 * Call this ONCE in the Apps Script editor's console
 *
 * Usage:
 * 1. Open Google Form
 * 2. Tools > Script editor
 * 3. Paste this entire script
 * 4. Run > installTrigger
 * 5. Authorize when prompted
 *
 * That's it! The form will now send webhooks.
 */
function installTrigger() {
  const form = FormApp.getActiveForm();

  // Remove existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach((trigger) => {
    ScriptApp.deleteTrigger(trigger);
  });

  // Install new trigger
  ScriptApp.newTrigger("onFormSubmit").onFormSubmit().create();

  console.log("✓ Trigger installed for form: " + form.getTitle());
}

// ============================================================================
// MANUAL WEBHOOK TEST (for debugging)
// ============================================================================

/**
 * Manually test the webhook with sample data
 * Run this to verify your webhook URL and signature are working
 */
function testWebhook() {
  const form = FormApp.getActiveForm();
  const triggerId = form.getDescription().match(/triggerId:(\w+)/)?.[1];

  if (!triggerId) {
    console.error("triggerId not found in form description");
    return;
  }

  const payload = {
    eventId: Utilities.getUuid(),
    formId: form.getId(),
    responseId: "test-response-" + Date.now(),
    answers: {
      Name: "Test User",
      Email: "test@example.com",
    },
    submittedAt: new Date().toISOString(),
  };

  const signature = Utilities.computeHmacSha256Signature(
    JSON.stringify(payload),
    WEBHOOK_SECRET,
  );
  const signatureHex = signature
    .map((b) => ("0" + (b & 0xff).toString(16)).slice(-2))
    .join("");

  const webhookUrl = `${WEBHOOK_BASE_URL}/api/webhooks/${triggerId}`;
  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "X-Signature": signatureHex,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(webhookUrl, options);
  console.log(`Test webhook response: ${response.getResponseCode()}`);
  console.log("Response body: " + response.getContentText());
}
