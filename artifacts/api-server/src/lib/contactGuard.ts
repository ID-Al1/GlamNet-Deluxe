// Detects phone numbers, emails and "message me elsewhere" hints in chat text.
// Used to keep a client and artist on Bonisa until their booking is paid.
// This is a speed bump, not a wall: it catches the common cases.

const EMAIL = /[a-z0-9._%+-]+\s*(?:@|\(at\))\s*[a-z0-9.-]+\s*(?:\.|\(dot\))\s*[a-z]{2,}/i;
const OFF_PLATFORM = /(?:whats\s*app|wa\.me|telegram|t\.me\/|instagram\.com|insta\s*dm|signal\s+me|dm\s+me\s+on)/i;
const PHONE_CANDIDATE = /\+?\d[\d\s().-]{6,}\d/g;

export function containsContactDetails(text: string): boolean {
  if (EMAIL.test(text) || OFF_PLATFORM.test(text)) return true;
  for (const match of text.match(PHONE_CANDIDATE) ?? []) {
    const digits = match.replace(/\D/g, "");
    if (digits.length >= 9 && digits.length <= 13) return true;
  }
  return false;
}
