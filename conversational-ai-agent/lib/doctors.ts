import { Doctor } from "./types";

export const DOCTORS: Doctor[] = [
  {
    name: "Dr. Smith",
    specialty: "knee",
    keywords: ["knee", "leg", "joint", "acl", "meniscus", "orthopedic", "walking", "limp"],
  },
  {
    name: "Dr. Patel",
    specialty: "heart",
    keywords: ["heart", "chest", "cardiac", "blood pressure", "palpitation", "cardio", "breathing", "shortness of breath"],
  },
  {
    name: "Dr. Lee",
    specialty: "skin",
    keywords: ["skin", "rash", "acne", "dermatology", "eczema", "mole", "itch", "hives", "psoriasis"],
  },
  {
    name: "Dr. Garcia",
    specialty: "eye",
    keywords: ["eye", "vision", "glasses", "blind", "blurry", "ophthalmology", "retina", "cataract", "glaucoma"],
  },
];

/**
 * Match a patient's reason/symptoms to a doctor.
 * Uses simple keyword matching on the reason string.
 */
export function matchDoctor(reason: string): Doctor | null {
  const lower = reason.toLowerCase();

  let bestMatch: Doctor | null = null;
  let bestScore = 0;

  for (const doctor of DOCTORS) {
    const score = doctor.keywords.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = doctor;
    }
  }

  return bestMatch;
}

