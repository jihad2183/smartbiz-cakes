export function isValidPhoneNumber(phone: string): boolean {
  const trimmed = phone.trim();
  const digitCount = trimmed.replace(/\D/g, "").length;
  return /^[+()\d\s.-]{7,24}$/.test(trimmed) && digitCount >= 7 && digitCount <= 15;
}
