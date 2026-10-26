/** South African numbers as WhatsApp wants them: digits only, with the country code. */
export function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? `27${digits.slice(1)}` : digits;
}

export function whatsappLink(phone: string, text: string): string {
  return `https://wa.me/${toWhatsAppNumber(phone)}?text=${encodeURIComponent(text)}`;
}
