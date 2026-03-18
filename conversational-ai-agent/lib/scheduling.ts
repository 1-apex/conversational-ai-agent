import { TimeSlot } from "./types";
import { DOCTORS } from "./doctors";

/** Generate availability slots for the next 45 days */
function generateSlots(): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const now = new Date();

  for (let i = 1; i <= 45; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() + i);

    const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "long" });
    const dateStr = date.toISOString().split("T")[0];
    const displayDate = date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

    // Tuesdays at 2:00 PM and Thursdays at 10:00 AM for each doctor
    for (const doctor of DOCTORS) {
      if (dayOfWeek === "Tuesday") {
        slots.push({
          date: dateStr,
          dayOfWeek: displayDate,
          time: "2:00 PM",
          doctorName: doctor.name,
          booked: false,
        });
      }
      if (dayOfWeek === "Thursday") {
        slots.push({
          date: dateStr,
          dayOfWeek: displayDate,
          time: "10:00 AM",
          doctorName: doctor.name,
          booked: false,
        });
      }
      // Extra Friday morning slot
      if (dayOfWeek === "Friday") {
        slots.push({
          date: dateStr,
          dayOfWeek: displayDate,
          time: "9:00 AM",
          doctorName: doctor.name,
          booked: false,
        });
      }
    }
  }

  return slots;
}

// In-memory slot store (resets on server restart)
let allSlots: TimeSlot[] | null = null;

function getSlots(): TimeSlot[] {
  if (!allSlots) allSlots = generateSlots();
  return allSlots;
}

/** Get available (unbooked) slots for a specific doctor */
export function getAvailableSlots(doctorName: string): TimeSlot[] {
  return getSlots().filter((s) => s.doctorName === doctorName && !s.booked);
}

/**
 * Filter slots by a natural language preference.
 * Supports: "tuesday", "thursday", "morning", "afternoon", etc.
 */
export function filterSlotsByPreference(
  slots: TimeSlot[],
  preference: string
): TimeSlot[] {
  const lower = preference.toLowerCase();

  return slots.filter((s) => {
    const dayMatch =
      (lower.includes("tuesday") && s.dayOfWeek.toLowerCase().includes("tuesday")) ||
      (lower.includes("thursday") && s.dayOfWeek.toLowerCase().includes("thursday")) ||
      (lower.includes("friday") && s.dayOfWeek.toLowerCase().includes("friday"));

    const timeMatch =
      (lower.includes("morning") && (s.time.includes("9:00 AM") || s.time.includes("10:00 AM"))) ||
      (lower.includes("afternoon") && s.time.includes("2:00 PM"));

    // If user mentions both day and time preference
    if (
      (lower.includes("tuesday") || lower.includes("thursday") || lower.includes("friday")) &&
      (lower.includes("morning") || lower.includes("afternoon"))
    ) {
      return dayMatch && timeMatch;
    }

    return dayMatch || timeMatch;
  });
}

/** Book a specific slot */
export function bookSlot(slot: TimeSlot): boolean {
  const allSlots = getSlots();
  const target = allSlots.find(
    (s) =>
      s.date === slot.date &&
      s.time === slot.time &&
      s.doctorName === slot.doctorName &&
      !s.booked
  );
  if (target) {
    target.booked = true;
    return true;
  }
  return false;
}

