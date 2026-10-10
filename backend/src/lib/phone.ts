/**
 * Convert a Ghanaian phone number to the international MSISDN format SMS
 * gateways expect (233XXXXXXXXX). Accepts 0244123456, 244123456,
 * +233244123456, 233244123456 and spaced/dashed variants.
 * Returns null when the input is not a valid Ghanaian mobile number.
 */
export function toGhanaMsisdn(phone: string): string | null {
  let digits = String(phone).replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (!/^\d+$/.test(digits)) return null;

  let local: string;
  if (digits.startsWith('233') && digits.length === 12) local = digits.slice(3);
  else if (digits.startsWith('0') && digits.length === 10) local = digits.slice(1);
  else if (digits.length === 9) local = digits;
  else return null;

  // Ghanaian mobile numbers start with 2 or 5 after the trunk prefix (e.g. 024, 054, 020, 050, 059).
  if (!/^[25]\d{8}$/.test(local)) return null;
  return `233${local}`;
}
