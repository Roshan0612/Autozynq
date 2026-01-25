# Zapier-Style Google Forms Integration Setup

## ✅ Implementation Complete

Your Google Forms integration is now **professional-grade**, similar to Zapier/Make. Here's what was built:

### What's New:

1. **Centralized Google Apps Script** (`docs/GOOGLE_FORMS_APPS_SCRIPT.gs`)
   - Single script that forwards form submissions to your app
   - HMAC SHA256 signature verification for security
   - Webhook includes: eventId, formId, responseId, answers, submittedAt

2. **Backend Integration**
   - `/api/google-forms/list` - Lists user's Google Forms
   - `/api/google-forms/schema` - Fetches form questions
   - `/api/webhooks/[triggerId]` - Signature verification & execution

3. **Builder UI Upgrade**
   - Removed manual "Form ID" input
   - Added form picker dropdown (fetches from Google)
   - Connection status display
   - Helper text showing template syntax

4. **Template Resolution**
   - Answer mapping: `{{steps.trigger1.answers.fieldName}}`
   - Works with Gmail and AI nodes
   - No manual field mapping needed

---

## 🚀 Step-by-Step Setup (User Perspective)

### Part 1: Install Google Apps Script (One-time setup)

This is a **one-time platform setup**. Do this once, then all users benefit:

1. **Create a Google Apps Script project:**
   - Go to [script.google.com](https://script.google.com)
   - New Project → name it "Autozynq Forms Bridge"
   - Copy the entire code from: [docs/GOOGLE_FORMS_APPS_SCRIPT.gs](docs/GOOGLE_FORMS_APPS_SCRIPT.gs)
   - Paste into the script editor

2. **Update configuration in the script:**
   - Find these lines at the top:
     ```javascript
     const WEBHOOK_BASE_URL = "http://localhost:3000";
     const WEBHOOK_SECRET = "your-shared-secret-key";
     ```
   - Change `WEBHOOK_BASE_URL` to your app URL (e.g., `https://autozynq.com`)
   - Change `WEBHOOK_SECRET` to match your `.env.local`:
     ```
     GOOGLE_FORMS_WEBHOOK_SECRET=autozynq-webhook-secret-key-change-in-production
     ```

3. **Deploy as Web App:**
   - Click **Deploy** → **New deployment** → Type: **Web app**
   - Execute as: Your account
   - Who has access: **Anyone**
   - Click **Deploy**
   - Note the deployment URL (you'll need it for documentation)

### Part 2: User connects their Google Form

In the workflow builder:

1. **Create new workflow**
2. **Add trigger:** Google Forms → New Response
3. **Click "Connect Google"** → Sign in with your Google account
4. **In "Select Form" dropdown:** Pick your Google Form
5. **See available fields:**
   - eventId
   - formId
   - responseId
   - submittedAt
   - respondentEmail
   - **answers.fieldName** (dynamic, from form questions)

### Part 3: Install the webhook on your form

**For each Google Form you want to automate:**

1. Open your Google Form
2. Click **⋯ (More)** → **Script editor**
3. Paste the same script code (from Part 1)
4. Find the form description and add this line:
   ```
   triggerId:j7xqwujcex9cfgsn
   ```
   (Replace `j7xqwujcex9cfgsn` with your actual trigger ID from the builder)

5. Run **`installTrigger()`** in the console
6. Authorize when prompted

**That's it!** Now every form submission will trigger your workflow.

### Part 4: Use answers in next nodes

In Gmail action, "To" field:
```
{{steps.trigger1.answers.Email}}
```

In Subject:
```
Thank you {{steps.trigger1.answers.Name}}!
```

In Body:
```
<p>Your response ID: {{steps.trigger1.responseId}}</p>
<p>Submitted: {{steps.trigger1.submittedAt}}</p>
```

---

## 🔄 How It Works (Architecture)

```
User submits Google Form
        ↓
Google Apps Script onFormSubmit() fires
        ↓
Script collects all answers
        ↓
Creates payload: { eventId, formId, responseId, answers: {...}, ... }
        ↓
Computes HMAC-SHA256 signature
        ↓
POST to /api/webhooks/[triggerId] with X-Signature header
        ↓
Autozynq verifies signature
        ↓
Extracts answers and runs workflow
        ↓
Gmail sends to {{steps.trigger1.answers.Email}}
        ↓
Email delivered! ✓
```

---

## 📋 Checklist

- [ ] Updated `.env.local` with `GOOGLE_FORMS_WEBHOOK_SECRET`
- [ ] Deployed Google Apps Script as Web App
- [ ] Updated script `WEBHOOK_BASE_URL` and `WEBHOOK_SECRET`
- [ ] Created workflow with Google Forms trigger
- [ ] Connected your Google account
- [ ] Selected form from dropdown
- [ ] Installed webhook on your Google Form (added triggerId to description)
- [ ] Ran `installTrigger()` in form's script editor
- [ ] Added `{{steps.trigger1.answers.fieldName}}` in Gmail node
- [ ] Tested form submission → Check Gmail inbox

---

## 🐛 Troubleshooting

### Form submission doesn't trigger workflow

1. Check trigger details page → Webhook URL
2. Test manually with cURL:
   ```bash
   curl -X POST http://localhost:3000/api/webhooks/j7xqwujcex9cfgsn \
     -H "Content-Type: application/json" \
     -H "X-Signature: test" \
     -d '{"eventId":"123","formId":"abc","responseId":"xyz","answers":{"Email":"test@example.com"}}'
   ```

3. Check form description contains `triggerId:j7xqwujcex9cfgsn`
4. Check Google Apps Script logs → Run `testWebhook()` to verify

### Signature verification fails

1. Ensure `GOOGLE_FORMS_WEBHOOK_SECRET` in `.env.local` matches script's `WEBHOOK_SECRET`
2. Restart dev server after changing `.env.local`

### Form dropdown is empty

1. Make sure connection is saved (blue checkmark)
2. Check connection has Gmail scope access (re-authenticate if needed)
3. Check you have at least one Google Form in your Drive

---

## 🎯 Next Steps

After testing works:

1. **Deploy to production:**
   - Update `WEBHOOK_BASE_URL` in Apps Script to your production URL
   - Update `.env.local` with production secret

2. **Multi-user setup:**
   - Each user installs Apps Script once on their form
   - Platform stores triggerId in form description
   - Backend automatically retrieves form schema

3. **Advanced features (future):**
   - Auto-install webhook via Apps Script API
   - Field picker with autocomplete
   - Connection validation on workflow activation
   - Token refresh handling
   - Execution audit logging

---

## 📚 Files Modified

| File | Change | Purpose |
|------|--------|---------|
| `docs/GOOGLE_FORMS_APPS_SCRIPT.gs` | NEW | Platform-owned Apps Script |
| `lib/nodes/google_forms/service.ts` | NEW | Google Forms API integration |
| `app/api/google-forms/list/route.ts` | NEW | List forms API |
| `app/api/google-forms/schema/route.ts` | NEW | Get form schema API |
| `app/api/webhooks/[triggerId]/route.ts` | UPDATED | Signature verification |
| `lib/nodes/google_forms/newResponse.trigger.ts` | UPDATED | Parse webhook payloads |
| `components/GoogleFormPicker.tsx` | NEW | Form selection UI |
| `WorkflowBuilderClient.tsx` | UPDATED | Integrated form picker |
| `.env.local` | UPDATED | Added `GOOGLE_FORMS_WEBHOOK_SECRET` |
| `lib/workflow/activation.ts` | UPDATED | Detect trigger type |

---

**Status: Ready for testing! 🎉**
