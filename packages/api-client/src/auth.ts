import { customFetch } from "./custom-fetch";
import type { User } from "./generated/api.schemas";

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export function changePassword(input: ChangePasswordInput): Promise<User> {
  return customFetch<User>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify(input),
    responseType: "json",
  });
}
