export type FulfillmentActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  submissionId?: string;
};

export const initialFulfillmentActionState: FulfillmentActionState = {
  status: "idle",
};
