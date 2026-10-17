export type DetailsActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: Record<string, string>;
  submissionId?: string;
};

export const initialDetailsState: DetailsActionState = { status: "idle" };
