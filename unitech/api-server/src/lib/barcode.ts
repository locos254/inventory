/** Generate a unique barcode for products (EAN-13-style numeric string) */
export function generateBarcode(): string {
  const timestamp = Date.now().toString().slice(-10);
  const random = Math.floor(Math.random() * 100).toString().padStart(2, "0");
  const base = `${timestamp}${random}`;
  // Compute EAN-13 check digit
  const digits = base.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return `${base}${check}`;
}
