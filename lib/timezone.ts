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
    hourCycle: 'h23', // Force 0-23 hour range (not 1-24)
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);

  let hours = getPart('hour');
  
  // Safety check: hour 24 should be converted to 0
  // This handles edge cases where some browsers/locales might return 24 for midnight
  if (hours === 24) {
    hours = 0;
  }
  
  // Validate hour range
  if (hours < 0 || hours > 23) {
    console.error(`Invalid hour value: ${hours} from date: ${date.toISOString()}`);
    hours = 0; // Fallback to midnight
  }

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    hours,
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
 * CRITICAL: The input string is ALREADY in Serbia timezone, so we need to interpret it as such.
 * We create a Date object that represents the Serbia time, accounting for the UTC offset.
 * 
 * For date arithmetic and comparisons, always use YYYY-MM-DD strings with addDaysYMD/diffDaysYMD.
 */
export function parseSerbiaDate(dateString: string): Date {
  // Handle YYYY-MM-DD format
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateString.split('-').map(Number);
    // Validate date components
    if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
      throw new Error(`Invalid date format: ${dateString}`);
    }
    // Create UTC date at midnight, then adjust for display
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  }
  
  // Handle YYYY-MM-DD HH:MM:SS format
  if (dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
    const [datePart, timePart] = dateString.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    let [hour, minute, second] = timePart.split(':').map(Number);
    
    // Handle hour 24 edge case (some systems use 24:00:00 for midnight)
    // Convert to next day at 00:00:00
    let adjustedDay = day;
    let adjustedMonth = month;
    let adjustedYear = year;
    
    if (hour === 24) {
      hour = 0;
      // Add one day
      const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
      adjustedYear = nextDay.getUTCFullYear();
      adjustedMonth = nextDay.getUTCMonth() + 1;
      adjustedDay = nextDay.getUTCDate();
    }
    
    // Validate all components
    if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute) || isNaN(second) ||
        month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
      throw new Error(`Invalid datetime format: ${dateString}`);
    }
    
    // CRITICAL FIX: The input string is in Serbia timezone, but we're creating a UTC Date.
    // When displayed with Serbia timezone, it will add the offset again, showing wrong time.
    // Solution: Subtract the Serbia offset from UTC to get the correct UTC timestamp.
    // Serbia is UTC+1 (winter) or UTC+2 (summer/DST)
    
    // Create a temporary date to check DST
    const tempDate = new Date(Date.UTC(adjustedYear, adjustedMonth - 1, adjustedDay, 12, 0, 0));
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: SERBIA_TIMEZONE,
      hour: 'numeric',
      hour12: false,
      timeZoneName: 'short'
    });
    const parts = formatter.formatToParts(tempDate);
    const tzName = parts.find(p => p.type === 'timeZoneName')?.value || '';
    
    // Determine offset: CET = UTC+1, CEST = UTC+2
    const offsetHours = tzName.includes('CEST') || tzName.includes('GMT+2') ? 2 : 1;
    
    // Subtract the offset to get the correct UTC time
    // If Serbia time is 00:52, and offset is +1, UTC should be 23:52 previous day
    return new Date(Date.UTC(adjustedYear, adjustedMonth - 1, adjustedDay, hour - offsetHours, minute, second));
  }
  
  // Throw error for unsupported formats instead of silently failing
  throw new Error(`Unsupported date format: ${dateString}. Expected YYYY-MM-DD or YYYY-MM-DD HH:MM:SS`);
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

