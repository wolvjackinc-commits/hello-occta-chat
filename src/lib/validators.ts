export const isAccountNumberValid = (value?: string) =>
  /^OCC\d{8}$/.test((value ?? "").trim());
