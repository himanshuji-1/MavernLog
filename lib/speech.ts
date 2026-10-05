/**
 * Helpers for the browser's Web Speech API (voice input in the quick log).
 * Pure functions, so the tricky parts are unit-tested.
 */

export type SpeechResultLike = { isFinal?: boolean; 0: { transcript: string } };

/**
 * Turns the recognizer's result list into one sentence.
 *
 * Phrases are joined with spaces (continuous mode gives one result per phrase).
 * Android Chrome sometimes repeats a phrase cumulatively ("weighed", "weighed 84",
 * "weighed 84.2"), so a result that extends the previous one replaces it.
 */
export function assembleTranscript(results: ArrayLike<SpeechResultLike>): string {
  const parts: string[] = [];
  for (const result of Array.from(results)) {
    const text = result[0]?.transcript?.trim() ?? "";
    if (!text) continue;
    const last = parts[parts.length - 1];
    if (last !== undefined && text.toLowerCase().startsWith(last.toLowerCase())) {
      parts[parts.length - 1] = text; // cumulative repeat: keep the longer one
    } else if (last !== undefined && last.toLowerCase().startsWith(text.toLowerCase())) {
      continue; // a shorter repeat of what we already have
    } else {
      parts.push(text);
    }
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** A clear, actionable message for each recognizer error ("" = say nothing). */
export function speechErrorMessage(code: string, isBrave = false): string {
  switch (code) {
    case "aborted":
      return ""; // we stopped it ourselves
    case "no-speech":
      return "I didn't hear anything. Tap the mic and try again.";
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked. Allow it in your browser's site settings, or use your keyboard's mic.";
    case "audio-capture":
      return "No microphone was found.";
    case "network":
      return isBrave
        ? "Brave doesn't support voice input. Use your keyboard's mic button, or open the app in Chrome or Safari."
        : "Voice input couldn't reach your browser's speech service. Check your connection, or use your keyboard's mic.";
    case "language-not-supported":
      return "Voice input doesn't support your language setting. Use your keyboard's mic instead.";
    default:
      return "Voice input stopped unexpectedly. Try again, or use your keyboard's mic.";
  }
}

/** Stop listening after this much silence. */
export const SILENCE_TIMEOUT_MS = 3000;
