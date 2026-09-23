/**
 * Rendering money.
 *
 * Mirrors the backend's `paiseToRupeeString`. Kept as its own tiny function
 * rather than an inline division because `paise / 100` reintroduces exactly the
 * floating-point problem the paise representation exists to avoid: 999999999/100
 * does not render cleanly, and a price that is one paisa out is the kind of bug
 * nobody reports and everybody notices.
 */
export function formatPaise(paise: number): string {
  if (!Number.isFinite(paise)) return "—";
  const negative: boolean = paise < 0;
  const absolute: number = Math.abs(Math.round(paise));
  const whole: number = Math.trunc(absolute / 100);
  const remainder: number = absolute % 100;
  const rendered = `₹${whole.toLocaleString("en-IN")}.${String(remainder).padStart(2, "0")}`;
  return negative ? `-${rendered}` : rendered;
}
