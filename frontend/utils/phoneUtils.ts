
/**
 * Normalizes phone input to E.164 format
 */
export const normalizePhone = (input: string): string => {
  if (!input) return "";
  
  // Remove spaces, dashes, parentheses
  const clean = input.replace(/[\s\-()]/g, "");

  // Handle Pakistan local format starting with 03 (e.g. 03001234567 -> +923001234567)
  if (clean.startsWith("03") && clean.length === 11) {
    return "+92" + clean.substring(1);
  }

  // Handle Pakistan local format without 0 (e.g. 3001234567 -> +923001234567)
  if (clean.startsWith("3") && clean.length === 10) {
    // Check if it looks like a mobile number (starts with 3)
    return "+92" + clean;
  }
  
  // If it starts with +, keep it
  if (clean.startsWith("+")) {
    return clean;
  }
  
  // If user enters 923... treat as PK
  if (clean.startsWith("92") && clean.length === 12) {
    return "+" + clean;
  }

  // Default: assume international without +, so add +? Or leave as is?
  // "otherwise require +countrycode for non-PK" -> imply user must type +
  // If no +, and not PK pattern, we return as is (and validation will fail)
  return clean;
};

/**
 * Formats phone number for display
 * - PK Local: "0300 1234567"
 * - PK International: "+92 300 1234567"
 * - Others: simple spacing
 */
export const formatPhone = (input: string): string => {
  if (!input) return "";
  
  // Remove existing formatting to re-process
  // But be careful not to remove +
  const raw = input.replace(/[\s\-()]/g, "");

  // PK Local: 03XX XXXXXXX
  if (raw.startsWith("03")) {
    if (raw.length > 4) {
      return `${raw.substring(0, 4)} ${raw.substring(4, 11)}`;
    }
    return raw;
  }

  // PK International: +92 3XX XXXXXXX
  if (raw.startsWith("+92")) {
    // +923001234567 -> +92 300 1234567
    const core = raw.substring(3); // Remove +92
    if (core.length === 0) return "+92";
    
    // Check if it's mobile (starts with 3)
    if (core.startsWith("3")) {
        let formatted = "+92";
        if (core.length > 0) formatted += " " + core.substring(0, 3);
        if (core.length > 3) formatted += " " + core.substring(3);
        return formatted;
    }
    
    // Landline or other: just space after code
    return `+92 ${core}`;
  }

  return input;
};

/**
 * Validates phone number
 * Returns null if valid, error message string if invalid
 */
export const validatePhone = (input: string): string | null => {
  if (!input) return null; // Allow empty? Prompt implies "Phone should be validated", maybe required?
  // If required, handled by form 'required' check. Here just format.

  const normalized = normalizePhone(input);

  // Must start with + for E.164
  if (!normalized.startsWith("+")) {
      // Allow local PK 03 format as input, but normalized should be +...
      // If normalize failed to add +, it's invalid.
      // But wait, normalizePhone handles 03->+92. So if it's still 03..., normalize failed?
      // No, normalizePhone returns +92... for 03 inputs.
      // If input was "12345", normalize returns "12345".
      return "Please include country code (e.g. +1 for US)";
  }

  // PK Specific Validation
  if (normalized.startsWith("+92")) {
      // Mobile: +92 3XX XXXXXXX (12 digits total excluding +? No, 12 digits total including 92? )
      // Standard PK mobile: 92 (2) + 3XX (3) + 7 = 12 digits.
      // So length must be 13 (including +).
      if (normalized.length !== 13) {
           return "Pakistan mobile numbers must be 11 digits (e.g. 0300 1234567)";
      }
      
      // Mobile prefix check (starts with 3 after 92)
      // index 3 is the 4th char: + (0), 9 (1), 2 (2), 3 (3)
      // "PK mobile ... starts with 3"
      // "Landlines optional"
      // If it starts with 3, strict length check is good.
      // If it doesn't start with 3 (landline), we accept but maybe looser check?
      // Prompt: "Landlines optional: accept but require +92 and proper length"
      // Most landlines are also 10-11 digits total. 
      // e.g. Lahore 042 12345678 -> +92 42 12345678 (12 digits).
      // So length 13 is good default.
  } else {
      // International generic check
      // E.164: max 15 digits.
      if (normalized.length < 8 || normalized.length > 16) {
          return "Invalid phone number length";
      }
  }

  return null;
};
