// Shared by the browser and the API. Kept apart from the schemas so that importing
// a limit doesn't pull the validation library into the client bundle.
export const MAX_CALLER_TEXT = 2_000;
export const MAX_TURN_TEXT   = 4_000;
export const MAX_HISTORY     = 200;
export const MAX_SPEECH_TEXT = 1_000;
