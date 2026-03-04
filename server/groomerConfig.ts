/**
 * Groomer configuration for multi-groomer scheduling.
 *
 * Each groomer has a unique ID, display name, working schedule, and list of
 * services they are qualified to perform.  The `squareTeamMemberId` field will
 * be populated with actual Square team member IDs once the Square integration
 * is wired up — leave as empty strings until then.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GroomerScheduleDay {
  day: string; // e.g. "Monday"
  startHour: number; // 24-hr, e.g. 9
  endHour: number; // 24-hr, e.g. 17
}

export interface GroomerServiceCapability {
  serviceId: string; // matches id in siteData services
  petType: "dog" | "cat";
  sizes?: string[]; // if omitted → all sizes
}

export interface Groomer {
  id: string;
  displayName: string;
  /** Populated later with the real Square team member ID */
  squareTeamMemberId: string;
  schedule: GroomerScheduleDay[];
  capabilities: GroomerServiceCapability[];
  /** If true, this groomer gets priority assignment for matching services */
  priorityFor?: string[];
}

// ---------------------------------------------------------------------------
// Size helpers
// ---------------------------------------------------------------------------

const ALL_DOG_SIZES = ["Small", "Medium", "Large", "XL"];
const SMALL_ONLY = ["Small"];

// ---------------------------------------------------------------------------
// Groomer definitions
// ---------------------------------------------------------------------------

export const GROOMERS: Groomer[] = [
  {
    id: "lindsay",
    displayName: "Lindsay",
    squareTeamMemberId: "", // TODO: populate with Square team member ID
    schedule: [
      { day: "Monday", startHour: 9, endHour: 17 },
      { day: "Tuesday", startHour: 9, endHour: 17 },
      { day: "Thursday", startHour: 9, endHour: 17 },
      { day: "Friday", startHour: 9, endHour: 17 },
      { day: "Saturday", startHour: 10, endHour: 18 },
    ],
    capabilities: [
      { serviceId: "basic-grooming", petType: "dog", sizes: ALL_DOG_SIZES },
    ],
    priorityFor: ["basic-grooming"],
  },
  {
    id: "serena",
    displayName: "Serena",
    squareTeamMemberId: "", // TODO: populate with Square team member ID
    schedule: [
      { day: "Monday", startHour: 9, endHour: 17 },
      { day: "Tuesday", startHour: 9, endHour: 17 },
      { day: "Wednesday", startHour: 9, endHour: 17 },
      { day: "Thursday", startHour: 9, endHour: 17 },
      { day: "Friday", startHour: 9, endHour: 17 },
    ],
    capabilities: [
      { serviceId: "basic-grooming", petType: "dog", sizes: ALL_DOG_SIZES },
      { serviceId: "deluxe-grooming", petType: "dog", sizes: ALL_DOG_SIZES },
    ],
  },
  {
    id: "teagan",
    displayName: "Teagan",
    squareTeamMemberId: "", // TODO: populate with Square team member ID
    schedule: [
      { day: "Tuesday", startHour: 9, endHour: 17 },
      { day: "Wednesday", startHour: 9, endHour: 17 },
      { day: "Thursday", startHour: 9, endHour: 17 },
      { day: "Friday", startHour: 9, endHour: 17 },
      { day: "Saturday", startHour: 10, endHour: 18 },
    ],
    capabilities: [
      { serviceId: "basic-grooming", petType: "dog", sizes: ALL_DOG_SIZES },
      { serviceId: "deluxe-grooming", petType: "dog", sizes: ALL_DOG_SIZES },
    ],
  },
  {
    id: "ginger",
    displayName: "Ginger",
    squareTeamMemberId: "", // TODO: populate with Square team member ID
    schedule: [
      { day: "Wednesday", startHour: 10, endHour: 17 },
      { day: "Saturday", startHour: 13, endHour: 18 },
    ],
    capabilities: [
      { serviceId: "basic-grooming", petType: "dog", sizes: SMALL_ONLY },
      { serviceId: "deluxe-grooming", petType: "dog", sizes: SMALL_ONLY },
      { serviceId: "cat-bath", petType: "cat" },
      { serviceId: "cat-groom", petType: "cat" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Runtime: populate Square team member IDs by matching display names
// ---------------------------------------------------------------------------

/**
 * Match Square team members to our groomer definitions by first name.
 * Called once at startup. Logs the mapping for visibility.
 */
export function populateTeamMemberIds(
  squareMembers: Array<{ id: string; displayName: string; givenName?: string }>,
): void {
  for (const groomer of GROOMERS) {
    const nameLower = groomer.displayName.toLowerCase();
    const match = squareMembers.find((m) => {
      const given = (m.givenName || "").toLowerCase();
      const display = m.displayName.toLowerCase();
      return given === nameLower || display.startsWith(nameLower);
    });

    if (match) {
      groomer.squareTeamMemberId = match.id;
      console.log(`GROOMER MAP: ${groomer.displayName} → ${match.id} (matched "${match.displayName}")`);
    } else {
      console.warn(`GROOMER MAP: ${groomer.displayName} → NO MATCH in Square team members`);
    }
  }

  const mapped = GROOMERS.filter((g) => g.squareTeamMemberId).length;
  console.log(`GROOMER MAP: ${mapped}/${GROOMERS.length} groomers mapped to Square team member IDs`);
}

/**
 * Get all Square team member IDs that are configured on our groomers.
 */
export function getConfiguredTeamMemberIds(): string[] {
  return GROOMERS.filter((g) => g.squareTeamMemberId).map((g) => g.squareTeamMemberId);
}

// ---------------------------------------------------------------------------
// NOT schedulable online (walk-in / admin only)
// ---------------------------------------------------------------------------
// - "cat-nail-trim"        → walk-in only
// - "dog-nail-trim"        → walk-in only
// - "self-service-dog-wash"→ 24/7, no appointment needed
// - "gary"                 → admin only, not a groomer

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Return groomers qualified for the given service (and optionally pet size).
 *
 * For basic grooming Lindsay is returned first (priority groomer).
 */
export function getQualifiedGroomers(
  serviceId: string,
  petSize?: string,
): Groomer[] {
  const qualified = GROOMERS.filter((g) =>
    g.capabilities.some((cap) => {
      if (cap.serviceId !== serviceId) return false;
      if (petSize && cap.sizes && !cap.sizes.includes(petSize)) return false;
      return true;
    }),
  );

  // Sort so that groomers with priority for this service come first
  qualified.sort((a, b) => {
    const aPriority = a.priorityFor?.includes(serviceId) ? 0 : 1;
    const bPriority = b.priorityFor?.includes(serviceId) ? 0 : 1;
    return aPriority - bPriority;
  });

  return qualified;
}

/**
 * Check whether a groomer is working at a specific date and time.
 *
 * @param groomerId - groomer id (e.g. "lindsay")
 * @param date      - ISO date string e.g. "2026-03-05"
 * @param time      - 24-hr time string e.g. "14:00"
 */
export function isGroomerWorking(
  groomerId: string,
  date: string,
  time: string,
): boolean {
  const groomer = GROOMERS.find((g) => g.id === groomerId);
  if (!groomer) return false;

  const dateObj = new Date(date + "T12:00:00"); // noon to avoid TZ issues
  const dayName = DAY_NAMES[dateObj.getDay()];
  const [hourStr, minStr] = time.split(":");
  const timeDecimal = parseInt(hourStr, 10) + parseInt(minStr, 10) / 60;

  return groomer.schedule.some(
    (s) =>
      s.day === dayName &&
      timeDecimal >= s.startHour &&
      timeDecimal < s.endHour,
  );
}

/**
 * Return all groomers who are working on a given date (any shift that day).
 *
 * @param date - ISO date string e.g. "2026-03-05"
 */
export function getWorkingGroomers(date: string): Groomer[] {
  const dateObj = new Date(date + "T12:00:00");
  const dayName = DAY_NAMES[dateObj.getDay()];

  return GROOMERS.filter((g) => g.schedule.some((s) => s.day === dayName));
}
