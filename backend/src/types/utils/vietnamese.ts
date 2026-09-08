/**
 * Remove Vietnamese tone marks from a string.
 *
 * Example: "Trà sữa" -> "Tra sua"
 */
export function removeVietnameseTones(input: string): string {
  if (!input) return input;

  // Normalize to decomposed form, then strip combining diacritics.
  return String(input)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

