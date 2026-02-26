export interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  available: boolean;
}

export interface CalendarProvider {
  listAvailability(date: Date): Promise<TimeSlot[]>;
  createHold(slotId: string): Promise<{ holdId: string }>;
  releaseHold(holdId: string): Promise<void>;
}

function generateTimeSlots(date: Date): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const dayOfWeek = date.getDay();

  if (dayOfWeek === 0) return slots;

  const startHour = dayOfWeek === 6 ? 9 : 8;
  const endHour = dayOfWeek === 4 || dayOfWeek === 5 ? 19 : 18;

  const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();

  for (let hour = startHour; hour < endHour; hour++) {
    for (const minutes of [0, 30]) {
      const slotId = `${date.toISOString().split("T")[0]}-${hour.toString().padStart(2, "0")}${minutes.toString().padStart(2, "0")}`;
      const startTime = `${hour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
      const endMinutes = minutes + 30;
      const endHourCalc = endMinutes >= 60 ? hour + 1 : hour;
      const endMin = endMinutes >= 60 ? endMinutes - 60 : endMinutes;
      const endTime = `${endHourCalc.toString().padStart(2, "0")}:${endMin.toString().padStart(2, "0")}`;

      const hashVal = ((seed + hour * 60 + minutes) * 2654435761) >>> 0;
      const available = (hashVal % 100) > 30;

      slots.push({ id: slotId, startTime, endTime, available });
    }
  }

  return slots;
}

export class MockCalendarProvider implements CalendarProvider {
  private holds: Map<string, string> = new Map();

  async listAvailability(date: Date): Promise<TimeSlot[]> {
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));
    return generateTimeSlots(date);
  }

  async createHold(slotId: string): Promise<{ holdId: string }> {
    await new Promise((r) => setTimeout(r, 200));
    const holdId = `hold-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    this.holds.set(holdId, slotId);
    return { holdId };
  }

  async releaseHold(holdId: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 100));
    this.holds.delete(holdId);
  }
}

export const calendarProvider: CalendarProvider = new MockCalendarProvider();
