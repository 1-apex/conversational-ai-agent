export interface PatientInfo {
  firstName?: string;
  lastName?: string;
  dob?: string;
  phone?: string;
  email?: string;
  reason?: string;
}

export interface Doctor {
  name: string;
  specialty: string;
  keywords: string[]; // symptom keywords that map to this doctor
}

export interface TimeSlot {
  date: string;       
  dayOfWeek: string;  
  time: string;       
  doctorName: string;
  booked: boolean;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export type IntakeField = keyof PatientInfo;

/** The conversation flow steps */
export type ConversationStep =
  | "greeting"
  | "collect_firstName"
  | "collect_lastName"
  | "collect_dob"
  | "collect_phone"
  | "collect_email"
  | "collect_reason"
  | "match_doctor"
  | "offer_slots"
  | "confirm_booking"
  | "booked"
  | "no_match"
  | "general";

export interface ConversationState {
  step: ConversationStep;
  patientInfo: PatientInfo;
  matchedDoctor?: Doctor;
  selectedSlot?: TimeSlot;
  offeredSlots?: TimeSlot[];
}

export interface ChatRequest {
  message: string;
  conversationState: ConversationState;
}

export interface ChatResponse {
  reply: string;
  conversationState: ConversationState;
}

