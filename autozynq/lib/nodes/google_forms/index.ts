import { googleFormsNewResponseTrigger } from "./newResponse.trigger";
import { googleFormsGetFormAction } from "./getForm.action";
import { googleFormsGetResponseAction } from "./getResponse.action";
import { googleFormsListResponsesAction } from "./listResponses.action";

export const googleFormsNodes = {
  [googleFormsNewResponseTrigger.type]: googleFormsNewResponseTrigger,
  [googleFormsGetFormAction.type]: googleFormsGetFormAction,
  [googleFormsGetResponseAction.type]: googleFormsGetResponseAction,
  [googleFormsListResponsesAction.type]: googleFormsListResponsesAction,
};
