import * as crypto from "crypto";

export const hashCode = (val: string): number => {
  var hash = 0,
    i,
    chr;
  if (val.length === 0) return hash;
  for (i = 0; i < val.length; i++) {
    chr = val.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

export const get8DigitsCode = (message: string): string => {
  const hash = crypto.createHash("sha256").update(message).digest("hex");
  const first8HexCharacters = hash.slice(0, 8);
  const int = parseInt(first8HexCharacters, 16) % 100000000;
  let code = int.toString();
  code =
    Array(8 - code.length)
      .fill(0)
      .join("") + code;
  return code;
};
