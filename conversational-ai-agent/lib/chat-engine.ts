import { ConversationState, ChatResponse } from "./types";
import { matchDoctor } from "./doctors";
import {
  getAvailableSlots,
  filterSlotsByPreference,
  bookSlot,
} from "./scheduling";

const MEDICAL_ADVICE_KEYWORDS = [
  "diagnose", "diagnosis", "treatment", "medicine", "drug", "prescription",
  "should i take", "is it serious", "what do i have", "cure",
];

function isMedicalAdviceRequest(msg: string): boolean {
  const lower = msg.toLowerCase();
  return MEDICAL_ADVICE_KEYWORDS.some((kw) => lower.includes(kw));
}

export function processMessage(
  userMessage: string,
  state: ConversationState
): ChatResponse {
  const msg = userMessage.trim();

  // Always intercept medical advice requests
  if (isMedicalAdviceRequest(msg)) {
    return reply(
      "I'm not able to provide medical advice, but I can help you schedule an appointment with one of our specialists. Would you like to do that?",
      state
    );
  }

  switch (state.step) {
    case "greeting":
      return reply(
        "Welcome to **Kyron Medical**! 👋 I'm your scheduling assistant. I can help you book an appointment with one of our specialists.\n\nTo get started, could you please tell me your **first name**?",
        { ...state, step: "collect_firstName" }
      );

    case "collect_firstName":
      return reply(`Thanks, ${msg}! And your **last name**?`, {
        ...state,
        step: "collect_lastName",
        patientInfo: { ...state.patientInfo, firstName: msg },
      });

    case "collect_lastName":
      return reply(
        `Great, ${state.patientInfo.firstName} ${msg}. What is your **date of birth**? (e.g., 01/15/1990)`,
        {
          ...state,
          step: "collect_dob",
          patientInfo: { ...state.patientInfo, lastName: msg },
        }
      );

    case "collect_dob":
      return reply("Got it. What's the best **phone number** to reach you?", {
        ...state,
        step: "collect_phone",
        patientInfo: { ...state.patientInfo, dob: msg },
      });

    case "collect_phone":
      return reply("And your **email address**?", {
        ...state,
        step: "collect_email",
        patientInfo: { ...state.patientInfo, phone: msg },
      });

    case "collect_email":
      return reply(
        "Thanks! Now, could you briefly describe your **reason for the visit**? (e.g., knee pain, blurry vision, skin rash)",
        {
          ...state,
          step: "collect_reason",
          patientInfo: { ...state.patientInfo, email: msg },
        }
      );

    case "collect_reason": {
      const updatedInfo = { ...state.patientInfo, reason: msg };
      const doctor = matchDoctor(msg);

      if (!doctor) {
        return reply(
          "I'm sorry, we don't currently treat that condition. Our specialists cover **knee/orthopedic**, **heart/cardiac**, **skin/dermatology**, and **eye/vision** concerns. Could you describe your symptoms differently, or would you like help with something else?",
          { ...state, step: "collect_reason", patientInfo: updatedInfo }
        );
      }

      const slots = getAvailableSlots(doctor.name);
      const nextSlots = slots.slice(0, 3);

      let slotList = nextSlots
        .map((s, i) => `  ${i + 1}. **${s.dayOfWeek}** at **${s.time}**`)
        .join("\n");

      return reply(
        `Based on your symptoms, I'd recommend **${doctor.name}** (${doctor.specialty} specialist). 🩺\n\nHere are the next available appointments:\n${slotList}\n\nWould any of these work for you? You can also say something like "Do you have Tuesday?" or "Morning only".`,
        {
          ...state,
          step: "offer_slots",
          patientInfo: updatedInfo,
          matchedDoctor: doctor,
          offeredSlots: nextSlots,
        }
      );
    }

    case "offer_slots": {
      if (!state.matchedDoctor) {
        return reply("Something went wrong. Let's start over.", {
          ...state,
          step: "greeting",
        });
      }

      const allSlots = getAvailableSlots(state.matchedDoctor.name);
      // Check if user picked a number (1, 2, 3)
      const pickNum = parseInt(msg);
      if (
        !isNaN(pickNum) &&
        state.offeredSlots &&
        pickNum >= 1 &&
        pickNum <= state.offeredSlots.length
      ) {
        const chosen = state.offeredSlots[pickNum - 1];
        return reply(
          `You've selected **${chosen.dayOfWeek}** at **${chosen.time}** with **${state.matchedDoctor.name}**.\n\nShall I confirm this booking? (yes/no)`,
          { ...state, step: "confirm_booking", selectedSlot: chosen }
        );
      }

      // Natural language slot filtering
      const filtered = filterSlotsByPreference(allSlots, msg);
      if (filtered.length === 0) {
        const fallback = allSlots.slice(0, 3);
        let slotList = fallback
          .map((s, i) => `  ${i + 1}. **${s.dayOfWeek}** at **${s.time}**`)
          .join("\n");
        return reply(
          `I couldn't find slots matching "${msg}". Here are the next available times:\n${slotList}\n\nPick a number or describe your preference.`,
          { ...state, offeredSlots: fallback }
        );
      }

      const top = filtered.slice(0, 3);
      let slotList = top
        .map((s, i) => `  ${i + 1}. **${s.dayOfWeek}** at **${s.time}**`)
        .join("\n");

      return reply(
        `Here's what I found:\n${slotList}\n\nPick a number to select, or refine your preference.`,
        { ...state, offeredSlots: top }
      );
    }

    case "confirm_booking": {
      const lower = msg.toLowerCase();
      if (lower.includes("yes") || lower.includes("confirm") || lower.includes("sure") || lower.includes("book")) {
        if (state.selectedSlot) {
          bookSlot(state.selectedSlot);
        }
        const slot = state.selectedSlot;
        const pi = state.patientInfo;
        return reply(
          `✅ **Appointment Confirmed!**\n\n` +
          `**Patient:** ${pi.firstName} ${pi.lastName}\n` +
          `**Doctor:** ${state.matchedDoctor?.name}\n` +
          `**Date:** ${slot?.dayOfWeek}\n` +
          `**Time:** ${slot?.time}\n\n` +
          `We'll send a confirmation to **${pi.email}** and a reminder to **${pi.phone}**.\n\n` +
          `Is there anything else I can help you with? You can also click **"Continue via Phone"** below if you'd like to speak with us directly.`,
          { ...state, step: "booked" }
        );
      }

      if (lower.includes("no") || lower.includes("cancel") || lower.includes("different")) {
        const slots = state.matchedDoctor
          ? getAvailableSlots(state.matchedDoctor.name).slice(0, 3)
          : [];
        const slotList = slots
          .map((s, i) => `  ${i + 1}. **${s.dayOfWeek}** at **${s.time}**`)
          .join("\n");
        return reply(
          `No problem! Here are other available times:\n${slotList}\n\nPick a number or tell me your preference.`,
          { ...state, step: "offer_slots", offeredSlots: slots }
        );
      }

      return reply("Please confirm with **yes** or **no**.", state);
    }

    case "booked":
      if (msg.toLowerCase().includes("appointment") || msg.toLowerCase().includes("book") || msg.toLowerCase().includes("schedule")) {
        return reply(
          "I'd be happy to help you book another appointment! Let me collect your information.\n\nWhat is your **first name**?",
          { step: "collect_firstName", patientInfo: {} }
        );
      }
      return reply(
        "Thank you for choosing **Kyron Medical**! If you need to schedule another appointment, just let me know. Have a great day! 😊",
        state
      );

    case "no_match":
      return reply(
        "Our specialists cover **knee/orthopedic**, **heart/cardiac**, **skin/dermatology**, and **eye/vision** concerns. Could you describe your symptoms differently?",
        { ...state, step: "collect_reason" }
      );

    default:
      // Detect scheduling intent from general messages
      if (
        msg.toLowerCase().includes("appointment") ||
        msg.toLowerCase().includes("book") ||
        msg.toLowerCase().includes("schedule") ||
        msg.toLowerCase().includes("doctor") ||
        msg.toLowerCase().includes("pain") ||
        msg.toLowerCase().includes("visit")
      ) {
        return reply(
          "I'd be happy to help you schedule an appointment! Let me collect some information first.\n\nWhat is your **first name**?",
          { ...state, step: "collect_firstName" }
        );
      }

      return reply(
        "Hello! I'm the **Kyron Medical** scheduling assistant. I can help you book an appointment with one of our specialists.\n\nJust say something like **\"I need to see a doctor\"** or **\"I have knee pain\"** to get started!",
        state
      );
  }
}

function reply(content: string, newState: ConversationState): ChatResponse {
  return { reply: content, conversationState: newState };
}

