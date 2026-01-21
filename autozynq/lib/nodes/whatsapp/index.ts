import { whatsappSendMessageAction } from "./sendMessage.action";

// Export all WhatsApp nodes for registration
export const whatsappNodes = {
  [whatsappSendMessageAction.type]: whatsappSendMessageAction,
};
