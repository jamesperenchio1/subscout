import { HOME_CURRENCY, HOME_LOCALE } from "./thailand";

export function monthlyAmount(amount: number | null, cycle: string | null): number {
  if (!amount) return 0;
  switch (cycle) {
    case "monthly": return amount;
    case "annual":  return amount / 12;
    case "weekly":  return amount * 4.345;
    case "one_time":
    case "unknown":
    case null:
    default:        return 0;
  }
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(currency === "THB" ? HOME_LOCALE : "en-US", {
      style: "currency",
      currency: currency || HOME_CURRENCY,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function daysUntil(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
