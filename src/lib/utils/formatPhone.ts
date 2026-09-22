export type WhatsAppCountryCode = "970" | "972";

export function normalizePhoneNumber(value: string): string {
  return value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 10);
}

export function formatPhone(
  phoneNumber: string,
  countryCode: WhatsAppCountryCode,
): string {
  return `+${countryCode}${normalizePhoneNumber(phoneNumber)}`;
}
