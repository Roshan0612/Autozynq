import { smtpSendEmailAction } from "./smtpSend.action";

export const emailNodes = {
  [smtpSendEmailAction.type]: smtpSendEmailAction,
};
