export type AuthFieldErrors = Partial<
  Record<"email" | "password" | "confirmPassword", string>
>;

export type AuthActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: AuthFieldErrors;
  values?: { email?: string };
  submissionId?: string;
};

export const initialAuthActionState: AuthActionState = {
  status: "idle",
};
