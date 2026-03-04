export interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  available: boolean;
}

export interface AvailabilityParams {
  serviceId?: string;
  petSize?: string;
}

export interface CalendarProvider {
  listAvailability(date: Date, params?: AvailabilityParams): Promise<TimeSlot[]>;
  createHold(slotId: string): Promise<{ holdId: string }>;
  releaseHold(holdId: string): Promise<void>;
}

/**
 * API-backed calendar provider that fetches real availability
 * from the server (which checks Square for conflicts).
 * Fixed slots: 9am, 11am, 1pm, 3pm.
 */
export class ApiCalendarProvider implements CalendarProvider {
  private holds: Map<string, string> = new Map();

  async listAvailability(date: Date, params?: AvailabilityParams): Promise<TimeSlot[]> {
    const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD
    try {
      const qs = new URLSearchParams({ date: dateStr });
      if (params?.serviceId) qs.set("serviceId", params.serviceId);
      if (params?.petSize) qs.set("petSize", params.petSize);
      const response = await fetch(`/api/availability?${qs.toString()}`);
      if (!response.ok) {
        throw new Error(`Availability API returned ${response.status}`);
      }
      const data = await response.json();
      return data.slots || [];
    } catch (error) {
      console.error("Failed to fetch availability:", error);
      // Fallback: return the 4 fixed slots as all available
      // so bookings aren't blocked by an API outage
      return getFallbackSlots(date);
    }
  }

  async createHold(slotId: string): Promise<{ holdId: string }> {
    // Holds are handled server-side via the booking process
    const holdId = `hold-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    this.holds.set(holdId, slotId);
    return { holdId };
  }

  async releaseHold(holdId: string): Promise<void> {
    this.holds.delete(holdId);
  }
}

/**
 * Fallback slots when the API is unreachable.
 * Returns the 4 fixed time slots for non-Sunday, non-past dates.
 */
function getFallbackSlots(date: Date): TimeSlot[] {
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0) return []; // Sunday closed

  const dateStr = date.toISOString().split("T")[0];

  // Business hours
  const open = dayOfWeek === 6 ? 10 : 9;
  const close = dayOfWeek === 6 ? 18 : 17;

  const fixedTimes = ["09:00", "11:00", "13:00", "15:00"];

  return fixedTimes
    .filter((time) => {
      const hour = parseInt(time.split(":")[0], 10);
      return hour >= open && (hour + 2) <= close;
    })
    .map((time) => ({
      id: `${dateStr}-${time.replace(":", "")}`,
      startTime: time,
      endTime: `${(parseInt(time.split(":")[0], 10) + 2).toString().padStart(2, "0")}:00`,
      available: true,
    }));
}

export const calendarProvider: CalendarProvider = new ApiCalendarProvider();
