import { gmailNewEmailTrigger } from "./newEmail.trigger";

// Export all Gmail nodes for registration
export const gmailNodes = {
  [gmailNewEmailTrigger.type]: gmailNewEmailTrigger,
};
