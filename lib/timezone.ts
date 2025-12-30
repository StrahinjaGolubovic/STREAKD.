// Serbia timezone utilities (GMT+1 / CET/CEST)
// Serbia uses Central European Time (CET) which is UTC+1 in winter and UTC+2 in summer (CEST)
// Timezone: Europe/Belgrade

const SERBIA_TIMEZONE = 'Europe/Belgrade';

/**
 * Get current date/time components in Serbia timezone
 */
function getSerbiaTimeComponents(date: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: SERBIA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    hours: getPart('hour'),
    minutes: getPart('minute'),
    seconds: getPart('second'),
  };
}

/**
 * Format date as YYYY-MM-DD in Serbia timezone
 */
export function formatDateSerbia(date: Date = new Date()): string {
  const { year, month, day } = getSerbiaTimeComponents(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Format datetime as YYYY-MM-DD HH:MM:SS in Serbia timezone
 */
export function formatDateTimeSerbia(date: Date = new Date()): string {
  const { year, month, day, hours, minutes, seconds } = getSerbiaTimeComponents(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Get SQLite datetime string for Serbia timezone
 */
export function getSerbiaDateTimeSQLite(): string {
  return formatDateTimeSerbia();
}

/**
 * Get SQLite date string for Serbia timezone
 */
export function getSerbiaDateSQLite(): string {
  return formatDateSerbia();
}

/**
 * Parse a date string (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS) and return Date object
 * WARNING: This function is for DISPLAY purposes only (with Intl.DateTimeFormat).
 * For date arithmetic and comparisons, always use YYYY-MM-DD strings with addDaysYMD/diffDaysYMD.
 * 
 * This creates a Date object that when formatted with timeZone: 'Europe/Belgrade' will show the correct values.
 */
export function parseSerbiaDate(dateString: string): Date {
  // Handle YYYY-MM-DD format
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateString.split('-').map(Number);
    // Create UTC date at midnight, then adjust for display
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  }
  
  // Handle YYYY-MM-DD HH:MM:SS format
  if (dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
    const [datePart, timePart] = dateString.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute, second] = timePart.split(':').map(Number);
    // Create UTC date with the time components
    // This ensures consistent parsing regardless of client timezone
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  }
  
  // Fallback for other formats
  return new Date(dateString);
}

/**
 * Format date for display in English locale (but using Serbia timezone)
 */
export function formatDateDisplay(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? parseSerbiaDate(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    timeZone: SERBIA_TIMEZONE,
    ...options,
  });
}

/**
 * Format datetime for display in English locale (but using Serbia timezone)
 */
export function formatDateTimeDisplay(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? parseSerbiaDate(date) : date;
  return dateObj.toLocaleString('en-US', {
    timeZone: SERBIA_TIMEZONE,
    ...options,
  });
}

/**
 * Format time for display (HH:MM) in Serbia timezone
 * For SQLite datetime strings, extract time directly to avoid timezone conversion
 */
export function formatTimeDisplay(date: Date | string): string {
  // If it's a SQLite datetime string, extract time directly
  if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
    const [, timePart] = date.split(' ');
    const [hour, minute] = timePart.split(':');
    return `${hour}:${minute}`;
  }
  
  const dateObj = typeof date === 'string' ? parseSerbiaDate(date) : date;
  const { hours, minutes } = getSerbiaTimeComponents(dateObj);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Check if a date string is today in Serbia timezone
 */
export function isTodaySerbia(dateString: string): boolean {
  const today = formatDateSerbia();
  return dateString === today;
}

/**
 * Check if a date is in the past in Serbia timezone
 */
export function isPastSerbia(dateString: string): boolean {
  const today = formatDateSerbia();
  return dateString < today;
}

/**
 * Get current Date object adjusted to Serbia timezone
 * Note: JavaScript Date objects are always in UTC internally,
 * but this helps with comparisons when treating dates as Serbia local time
 */
export function getSerbiaNow(): Date {
  return new Date();
}

