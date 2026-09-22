export type OrderActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  submissionId?: string;
};

export const initialOrderActionState: OrderActionState = { status: "idle" };
