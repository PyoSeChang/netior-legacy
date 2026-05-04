/**
 * Shared utilities for continuous time-axis layouts.
 *
 * Values are expressed in epoch days (days since 1970-01-01), with optional
 * fractional values when a layout wants to preserve time-of-day.
 */

/** Convert Date to epoch days using local calendar parts. */
export function dateToEpochDays(d: Date): number {
  const utcDate = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor(utcDate / 86400000);
}

/** Convert epoch days to a local Date. */
export function epochDaysToDate(days: number): Date {
  const d = new Date(days * 86400000 + 43200000);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Convert an ISO date string to epoch days. */
export function isoToEpochDays(iso: string): number | null {
  const parts = iso.split('-');
  if (parts.length < 3) return null;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(d.getTime())) return null;
  return dateToEpochDays(d);
}

/** Today in epoch days. */
export function todayEpochDays(): number {
  return dateToEpochDays(new Date());
}

export const PIXELS_PER_DAY = 4;

export type TimeGranularity = 'day' | 'month' | 'year' | 'decade';

export function getGranularity(zoom: number): { major: TimeGranularity; minor: TimeGranularity } {
  const pxPerDay = PIXELS_PER_DAY * zoom;

  if (pxPerDay >= 15) {
    return { major: 'month', minor: 'day' };
  }
  if (pxPerDay >= 1.5) {
    return { major: 'year', minor: 'month' };
  }
  if (pxPerDay >= 0.1) {
    return { major: 'decade', minor: 'year' };
  }
  return { major: 'decade', minor: 'decade' };
}

export interface HeaderCell {
  label: string;
  screenX: number;
  screenWidth: number;
  epochDay: number;
}

export function generateHeaderCells(params: {
  granularity: TimeGranularity;
  zoom: number;
  panX: number;
  viewportWidth: number;
  originDay: number;
}): HeaderCell[] {
  const { granularity, zoom, panX, viewportWidth, originDay } = params;
  const pxPerDay = PIXELS_PER_DAY * zoom;
  const leftDay = originDay + (-panX) / pxPerDay;
  const rightDay = originDay + (viewportWidth - panX) / pxPerDay;

  const cells: HeaderCell[] = [];
  const maxCells = 200;

  if (granularity === 'day') {
    const start = Math.floor(leftDay);
    const end = Math.ceil(rightDay);
    for (let d = start; d <= end && cells.length < maxCells; d += 1) {
      const date = epochDaysToDate(d);
      cells.push({
        label: String(date.getDate()),
        screenX: (d - originDay) * pxPerDay + panX,
        screenWidth: pxPerDay,
        epochDay: d,
      });
    }
    return cells;
  }

  if (granularity === 'month') {
    const startDate = epochDaysToDate(Math.floor(leftDay));
    const endDate = epochDaysToDate(Math.ceil(rightDay));
    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endTime = new Date(endDate.getFullYear(), endDate.getMonth() + 2, 1).getTime();

    while (current.getTime() < endTime && cells.length < maxCells) {
      const next = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      const startDay = dateToEpochDays(current);
      const endDay = dateToEpochDays(next);
      cells.push({
        label: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`,
        screenX: (startDay - originDay) * pxPerDay + panX,
        screenWidth: (endDay - startDay) * pxPerDay,
        epochDay: startDay,
      });
      current = next;
    }
    return cells;
  }

  if (granularity === 'year') {
    const startDate = epochDaysToDate(Math.floor(leftDay));
    const endDate = epochDaysToDate(Math.ceil(rightDay));
    let year = startDate.getFullYear();
    const endYear = endDate.getFullYear() + 2;

    while (year < endYear && cells.length < maxCells) {
      const startDay = dateToEpochDays(new Date(year, 0, 1));
      const endDay = dateToEpochDays(new Date(year + 1, 0, 1));
      cells.push({
        label: String(year),
        screenX: (startDay - originDay) * pxPerDay + panX,
        screenWidth: (endDay - startDay) * pxPerDay,
        epochDay: startDay,
      });
      year += 1;
    }
    return cells;
  }

  const startDate = epochDaysToDate(Math.floor(leftDay));
  const endDate = epochDaysToDate(Math.ceil(rightDay));
  let decade = Math.floor(startDate.getFullYear() / 10) * 10;
  const endDecade = Math.floor(endDate.getFullYear() / 10) * 10 + 20;

  while (decade < endDecade && cells.length < maxCells) {
    const startDay = dateToEpochDays(new Date(decade, 0, 1));
    const endDay = dateToEpochDays(new Date(decade + 10, 0, 1));
    cells.push({
      label: `${decade}s`,
      screenX: (startDay - originDay) * pxPerDay + panX,
      screenWidth: (endDay - startDay) * pxPerDay,
      epochDay: startDay,
    });
    decade += 10;
  }

  return cells;
}

export function screenXToEpochDays(screenX: number, zoom: number, panX: number, originDay: number): number {
  const pxPerDay = PIXELS_PER_DAY * zoom;
  return originDay + (screenX - panX) / pxPerDay;
}

export function epochDaysToScreenX(epochDay: number, zoom: number, panX: number, originDay: number): number {
  const pxPerDay = PIXELS_PER_DAY * zoom;
  return (epochDay - originDay) * pxPerDay + panX;
}
