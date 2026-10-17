export function deliveryBadge(daysUntil: number | null): { text: string; className: string } {
  if (daysUntil === null) return { text: "немає прогнозу", className: "badge badge-none" };
  if (daysUntil === 0) return { text: "ЗАВІЗ СЬОГОДНІ", className: "badge badge-today" };
  if (daysUntil === 1) return { text: "завтра", className: "badge badge-soon" };
  return { text: `через ${daysUntil} дн.`, className: "badge badge-soon" };
}
