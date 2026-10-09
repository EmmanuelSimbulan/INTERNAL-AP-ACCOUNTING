export type BspUsdPhpRate = {
  rate: string;
  effectiveDate: string;
  source: string;
};

const monthNumbers: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

function cellText(cell: string) {
  return cell.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
}

export function parseBspDailyUsdPhp(html: string, today: string): BspUsdPhpRate | null {
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) =>
    [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => cellText(cell[1])),
  );
  const monthRow = rows.find((row) => row.some((cell) => /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2}$/i.test(cell)));
  if (!monthRow) return null;
  const monthColumns = monthRow.flatMap((cell, index) => {
    const found = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2})$/i.exec(cell);
    if (!found) return [];
    const month = monthNumbers[found[1][0].toUpperCase() + found[1].slice(1, 3).toLowerCase()];
    return [{ index, month, year: Number(`20${found[2]}`) }];
  });
  if (!monthColumns.length) return null;

  const candidates: BspUsdPhpRate[] = [];
  for (const row of rows) {
    const dayIndex = row.findIndex((cell) => /^\d{1,2}$/.test(cell));
    if (dayIndex < 0) continue;
    const day = Number(row[dayIndex]);
    if (day < 1 || day > 31) continue;
    for (const column of monthColumns) {
      const rate = row[column.index];
      if (!rate || !/^\d{1,3}(?:,\d{3})*(?:\.\d+)?$/.test(rate)) continue;
      const effectiveDate = `${column.year}-${column.month}-${String(day).padStart(2, "0")}`;
      if (effectiveDate <= today) candidates.push({ rate: rate.replace(/,/g, ""), effectiveDate, source: "https://www.bsp.gov.ph/statistics/external/day99_data.aspx" });
    }
  }
  candidates.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
  return candidates[0] ?? null;
}
