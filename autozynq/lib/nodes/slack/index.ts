import { slackSendMessageAction } from "./sendMessage.action";

// Export all Slack nodes for registration
export const slackNodes = {
  [slackSendMessageAction.type]: slackSendMessageAction,
};
