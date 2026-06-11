# Quick Start Guide - Using the New Nodes

## 🎯 1-Minute Overview

5 new nodes are now available in your workflow builder:

| Node | Type | Use Case |
|------|------|----------|
| **Google Forms** | Trigger | Start workflow when form is submitted |
| **AI Generate** | Action | Create content with AI (text or JSON) |
| **Gmail** | Action | Send emails to recipients |
| **WhatsApp** | Action | Send WhatsApp messages |
| **Instagram** | Action | Create Instagram posts |

---

## 🔧 How to Use Them

### Example 1: Auto-Reply to Form Submissions

**Goal:** When someone fills a form, send them an AI-generated thank you email.

**Steps:**
1. **Add Google Forms Trigger**
   - Click "+" → Select "Google Forms – New Response"
   - Set Form ID (from your form's URL)
   - Optional: Add conditions (e.g., only if email exists)

2. **Add AI Generate Text Action**
   - Click "+" → Select "AI Generate Text"
   - Write prompt: "Write a brief thank you email for someone who filled out our form"
   - Choose provider: Groq (fastest), OpenAI, or Gemini

3. **Add Gmail Send Email Action**
   - Click "+" → Select "Gmail Send Email"
   - To: `{{email}}` (from form)
   - Subject: `Thank you for your submission`
   - Body: `{{text}}` (from AI action)

4. **Connect with Edges**
   - Form → AI
   - AI → Gmail

5. **Activate** and send a test form submission

---

### Example 2: Post Updates to Instagram

**Goal:** Whenever AI generates content, post it to Instagram.

**Steps:**
1. **Add Manual Trigger** (for testing)
   - Click "+" → Select "Manual Trigger"

2. **Add AI Generate Text Action**
   - Prompt: "Create a catchy Instagram caption about today's topic"
   - Output format: Plain text

3. **Add Instagram Create Post Action**
   - Image URL: `https://example.com/image.jpg`
   - Caption: `{{text}}` (from AI)
   - Publish immediately: Yes

4. **Activate** and click "Execute" to post

---

### Example 3: WhatsApp Notifications

**Goal:** Notify a contact when something happens.

**Steps:**
1. **Add Webhook Trigger** (from external system)

2. **Add WhatsApp Send Message Action**
   - Phone: `+1234567890`
   - Message: `Your order #{{orderId}} has shipped!`

3. **Activate** and integrate with your system

---

## 📋 Node Reference

### Google Forms Trigger
```
type: google_forms.trigger.newResponse

Config example:
{
  "formId": "1nZ5h...abc",
  "includeAttachments": false,
  "conditions": [
    {
      "field": "email",
      "operator": "exists"
    }
  ]
}

Output: {responseId, submittedAt, answers, attachments}
```

### AI Generate Text
```
type: ai.action.generateText

Config example:
{
  "provider": "groq",
  "model": "llama-3.3-70b-versatile",
  "userPrompt": "Summarize this: {{content}}",
  "temperature": 0.7,
  "maxTokens": 500,
  "outputFormat": {
    "type": "json",
    "schema": {"summary": "string", "keywords": "array"}
  }
}

Output: {text, json, model, usage}
```

### Gmail Send Email
```
type: gmail.action.sendEmail

Config example:
{
  "to": "{{email}}",
  "cc": "manager@company.com",
  "subject": "Update from {{sender}}",
  "bodyHtml": "<p>{{message}}</p>"
}

Output: {messageId, status}
```

### WhatsApp Send Message
```
type: whatsapp.action.sendMessage

Config example:
{
  "phoneNumber": "{{phone}}",
  "message": "Hello {{name}}, your code is {{code}}"
}

Output: {messageId, delivered}
```

### Instagram Create Post
```
type: instagram.action.createPost

Config example:
{
  "imageUrl": "{{imageUrl}}",
  "caption": "Check out this! {{description}}",
  "publishImmediately": true
}

Output: {postId, url}
```

---

## 🎨 Template Syntax

All action nodes support templates using `{{field}}`:

**Simple field:**
```
{{email}}
{{name}}
{{responseId}}
```

**Nested field:**
```
{{user.email}}
{{form.answers.email}}
{{order.items.0.price}}
```

**In action:**
```
To: {{email}}
Subject: Hello {{user.name}}!
Message: Your order #{{order.id}} has arrived
```

---

## ⚙️ Configuration Tips

### For Each Node

**Required Fields:**
- All fields marked with red asterisk (*) are required
- Config won't save if required fields are empty
- Templates like `{{field}}` are allowed

**Optional Fields:**
- Grayed out fields can be left empty
- Good for advanced options

**Templates:**
- Use `{{fieldName}}` to reference previous output
- Try typing `{{` to see autocomplete suggestions
- Test with real data first

---

## 🧪 Testing Your Workflow

### Method 1: Manual Trigger
1. Add "Manual Trigger" at start
2. Click "Execute" on the trigger
3. Watch execution in Debug UI

### Method 2: Webhook Test
1. Copy webhook URL from trigger info
2. Use `curl` or Postman to POST data:
   ```bash
   curl -X POST https://yourdomain.com/api/webhooks/abc123 \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com"}'
   ```
3. Watch execution in Debug UI

### Method 3: Debug UI
1. Go to Executions tab
2. Click on latest execution
3. View step outputs and errors

---

## 🐛 Troubleshooting

### Execution Failed
1. Check Debug UI for error message
2. Verify all required fields are set
3. Test templates with sample data
4. Check external API credentials

### Template Not Working
1. Verify previous node completed successfully
2. Use exact field name (case-sensitive)
3. Check nested paths with dots: `{{user.email}}`
4. Try without template to see output

### Email/Message Not Sent
1. Check for API errors in Debug UI
2. Verify recipient address format
3. Check API credentials/auth
4. Try with test email first

---

## 📚 More Information

- **Full Specs:** See `NODES_IMPLEMENTATION.md`
- **All Nodes:** See `AVAILABLE_NODES.md`
- **API Docs:** See individual node files in `lib/nodes/`
- **Examples:** See `scripts/test-new-nodes.ts`

---

## 💡 Pro Tips

1. **Test incrementally:** Add one node at a time, test, then add next
2. **Use templates:** Leverage previous outputs for dynamic content
3. **Check logs:** Debug UI shows exact errors and outputs
4. **Start simple:** Use Manual Trigger first, then add webhooks
5. **Save often:** Save workflow after each change

---

## 🚀 Common Workflows

### 1. Lead Nurturing
```
Google Form (lead sign-up)
  ↓
AI Generate (personalized welcome message)
  ↓
Gmail (send welcome email)
  ↓
WhatsApp (send phone notification)
```

### 2. Social Media Content
```
Manual Trigger (when content ready)
  ↓
AI Generate (create captions)
  ↓
Instagram (post image with caption)
```

### 3. Support Automation
```
Google Form (customer request)
  ↓
AI Generate (draft response)
  ↓
Gmail (send to customer + CC team)
```

---

## ✅ Checklist Before Going Live

- [ ] All required fields filled
- [ ] Templates use correct field names
- [ ] Tested with sample data
- [ ] Verified outputs in Debug UI
- [ ] External APIs configured
- [ ] Credentials/auth set up
- [ ] Error messages look good
- [ ] Performance acceptable
- [ ] Ready to activate

---

## 📞 Need Help?

1. Check node descriptions in builder
2. Review template examples above
3. Look at `NODES_IMPLEMENTATION.md`
4. Run test script: `npx tsx scripts/test-new-nodes.ts`
5. Check Debug UI for detailed errors

**Status:** All nodes are production-ready! 🚀
