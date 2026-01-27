import { googleSheetsWatchNewRowsTrigger } from "./watchNewRows.trigger";
import { googleSheetsGetRowAction } from "./getRow.action";
import { googleSheetsSearchRowsAction } from "./searchRows.action";
import { googleSheetsUpdateRowAction } from "./updateRow.action";
import { googleSheetsCreateRowAction } from "./createRow.action";

export const googleSheetsNodes = {
  [googleSheetsWatchNewRowsTrigger.type]: googleSheetsWatchNewRowsTrigger,
  [googleSheetsGetRowAction.type]: googleSheetsGetRowAction,
  [googleSheetsSearchRowsAction.type]: googleSheetsSearchRowsAction,
  [googleSheetsUpdateRowAction.type]: googleSheetsUpdateRowAction,
  [googleSheetsCreateRowAction.type]: googleSheetsCreateRowAction,
};
