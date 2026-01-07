import { gmailNewEmailTrigger } from "./newEmail.trigger";
import { gmailSendEmailAction } from "./sendEmail.action";

// Export all Gmail nodes for registration
export const gmailNodes = {
  [gmailNewEmailTrigger.type]: gmailNewEmailTrigger,
  [gmailSendEmailAction.type]: gmailSendEmailAction,
};
