// Shared by the browser and the API. Kept apart from the schemas so that importing
// a limit doesn't pull the validation library into the client bundle.
export const MAX_CALLER_TEXT = 2_000;
