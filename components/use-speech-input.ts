"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SILENCE_TIMEOUT_MS, assembleTranscript, speechErrorMessage, type SpeechResultLike } from "@/lib/speech";

// The Web Speech API isn't in TypeScript's DOM types, and some browsers don't have it.
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<SpeechResultLike> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechCtor = new () => SpeechRecognitionLike;

function getSpeechCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const subscribeNever = () => () => {};

/**
 * Voice → text. Calls `onTranscript` with the full sentence heard so far (it
 * updates live while you speak). Stops on its own after a few seconds of silence.
 */
export function useSpeechInput(onTranscript: (text: string) => void) {
  // Only known after hydration, so the server and first client render agree.
  const supported = useSyncExternalStore(subscribeNever, () => getSpeechCtor() !== null, () => false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callback = useRef(onTranscript);
  useEffect(() => {
    callback.current = onTranscript;
  }, [onTranscript]);

  const clearSilenceTimer = () => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    silenceTimer.current = null;
  };

  const stop = useCallback(() => {
    clearSilenceTimer();
    recognition.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechCtor();
    if (!Ctor || recognition.current) return;
    setError(null);

    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.continuous = true; // don't stop at the first pause mid-sentence
    rec.interimResults = true; // show words as they're recognised
    rec.maxAlternatives = 1;

    const armSilenceTimer = () => {
      clearSilenceTimer();
      silenceTimer.current = setTimeout(() => rec.stop(), SILENCE_TIMEOUT_MS);
    };

    rec.onresult = (e) => {
      callback.current(assembleTranscript(e.results));
      armSilenceTimer();
    };
    rec.onerror = (e) => {
      const message = speechErrorMessage(e.error, "brave" in navigator);
      if (message) setError(message);
    };
    rec.onend = () => {
      clearSilenceTimer();
      recognition.current = null;
      setListening(false);
    };

    try {
      rec.start();
      recognition.current = rec;
      setListening(true);
      armSilenceTimer(); // also stops if nothing is said at all
    } catch {
      setError(speechErrorMessage("unknown"));
    }
  }, []);

  // Never leave the microphone on when the card goes away.
  useEffect(
    () => () => {
      clearSilenceTimer();
      recognition.current?.abort();
    },
    [],
  );

  return { supported, listening, error, start, stop, clearError: () => setError(null) };
}
