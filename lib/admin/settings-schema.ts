import { z } from "zod";

export const businessSettingsSchema = z.strictObject({
  version: z.coerce.number().int().min(1).max(2147483647),
  acceptingOrders: z.boolean(),
  pauseMessage: z.string().trim().min(10).max(240),
  ownerAlertEmail: z.union([z.email().max(254), z.literal("")]),
});
export type SettingsActionState = {
  status: "idle" | "error" | "success";
  message: string;
};
export const initialSettingsState: SettingsActionState = {
  status: "idle",
  message: "",
};
