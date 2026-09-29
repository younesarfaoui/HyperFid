const TZ = "Africa/Tunis";

const dateTime = new Intl.DateTimeFormat("fr-TN", {
  timeZone: TZ,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const dateOnly = new Intl.DateTimeFormat("fr-TN", {
  timeZone: TZ,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dayShort = new Intl.DateTimeFormat("fr-TN", { timeZone: "UTC", day: "2-digit", month: "short" });

const integer = new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 0 });

export function formatDateTime(value: string | null | undefined): string {
  return value ? dateTime.format(new Date(value)) : "—";
}

export function formatDate(value: string | null | undefined): string {
  return value ? dateOnly.format(new Date(value)) : "—";
}

/** For `YYYY-MM-DD` day buckets already computed in Africa/Tunis by Postgres. */
export function formatDay(isoDay: string): string {
  return dayShort.format(new Date(`${isoDay}T00:00:00Z`));
}

export function formatInt(value: number): string {
  return integer.format(value);
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toLocaleString("fr-TN", { maximumFractionDigits: digits })} %`;
}

/** French plural: 0 and 1 are singular. */
export function plural(n: number, singular: string, pluralForm: string): string {
  return `${formatInt(n)} ${Math.abs(n) < 2 ? singular : pluralForm}`;
}

export const STATUS_LABELS: Record<string, string> = {
  trial: "Essai",
  active: "Actif",
  past_due: "Impayé",
  suspended: "Suspendu",
  cancelled: "Résilié",
};
