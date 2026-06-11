/**
 * Autozynq Google Webhook Bridge
 *
 * Use this as a Google Apps Script project to forward Google events to Autozynq.
 *
 * Supported triggers:
 * - Google Forms onFormSubmit
 * - Google Sheets onEdit
 *
 * Notes:
 * - Google Drive does not expose a native Apps Script webhook trigger in the same
 *   way, so Drive automation should use a workflow trigger plus an external event
 *   source or a sheet/form that captures the Drive event you care about.
 */

const WEBHOOK_BASE_URL = "http://localhost:3000"; // Your Autozynq app URL
const WEBHOOK_SECRET = "your-shared-secret-key"; // Must match WEBHOOK_SECRET or GOOGLE_FORMS_WEBHOOK_SECRET

function buildSignature(payload) {
  const signature = Utilities.computeHmacSha256Signature(
    payload,
    WEBHOOK_SECRET,
  );
  return signature
    .map((b) => ("0" + (b & 0xff).toString(16)).slice(-2))
    .join("");
}

function postToWebhook(triggerId, payload) {
  const body = JSON.stringify(payload);
  const webhookUrl = `${WEBHOOK_BASE_URL}/api/webhooks/${triggerId}`;
  const response = UrlFetchApp.fetch(webhookUrl, {
    method: "post",
    contentType: "application/json",
    headers: {
      "X-Signature": buildSignature(body),
    },
    payload: body,
    muteHttpExceptions: true,
  });

  console.log(`[Webhook] Sent to ${triggerId}: ${response.getResponseCode()}`);
  return response;
}

function getTriggerIdFromDescription(description) {
  return String(description || "").match(/triggerId:([\w-]+)/)?.[1] || "";
}

function onFormSubmit(e) {
  try {
    const formResponse = e.response;
    const form = formResponse.getPageItems()[0]?.getParent();
    if (!form) return;

    const triggerId = getTriggerIdFromDescription(form.getDescription());
    if (!triggerId) return;

    const answers = {};
    formResponse.getItemResponses().forEach((itemResponse) => {
      answers[itemResponse.getItem().getTitle()] = itemResponse.getResponse();
    });

    postToWebhook(triggerId, {
      eventId: Utilities.getUuid(),
      formId: form.getId(),
      responseId: formResponse.getId(),
      answers,
      submittedAt: new Date().toISOString(),
      respondentEmail: formResponse.getRespondentEmail(),
    });
  } catch (error) {
    console.error("[Webhook] Form error:", error);
  }
}

function installFormTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger("onFormSubmit").onFormSubmit().create();
}

function onSheetEdit(e) {
  try {
    const sheet = e.range.getSheet();
    const spreadsheet = e.source;
    const triggerId = getTriggerIdFromDescription(spreadsheet.getDescription());
    if (!triggerId) return;

    const headerRow = 1;
    const rowNumber = e.range.getRow();
    if (rowNumber <= headerRow) return;

    const headers =
      sheet.getRange(headerRow, 1, 1, sheet.getLastColumn()).getValues()[0] ||
      [];
    const rawValues =
      sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0] ||
      [];
    const values = {};
    headers.forEach((header, index) => {
      if (header) values[String(header)] = rawValues[index] ?? "";
    });

    postToWebhook(triggerId, {
      eventId: Utilities.getUuid(),
      spreadsheetId: spreadsheet.getId(),
      sheetId: sheet.getSheetId(),
      sheetName: sheet.getName(),
      rowNumber,
      rawValues,
      values,
      editedRange: e.range.getA1Notation(),
      editedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Webhook] Sheet error:", error);
  }
}

function installSheetTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger("onSheetEdit").onEdit().create();
}
