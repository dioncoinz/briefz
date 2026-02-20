"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SpeechRecognitionResultItem = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  0: SpeechRecognitionResultItem;
  isFinal?: boolean;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    SpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type Props = {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  maxMinutes?: number;
};

export default function MeetingRecorderButton({
  onTranscript,
  disabled,
  maxMinutes = 15,
}: Props) {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [recording, setRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const SpeechRecognition = useMemo(
    () =>
      typeof window === "undefined"
        ? undefined
        : (window.SpeechRecognition || window.webkitSpeechRecognition),
    []
  );

  function formatElapsed(sec: number) {
    const mm = String(Math.floor(sec / 60)).padStart(2, "0");
    const ss = String(sec % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function stop() {
    recognitionRef.current?.stop();
    clearTimer();
    setRecording(false);
  }

  function start() {
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    setError(null);
    setElapsedSec(0);

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const text = last?.[0]?.transcript?.trim();
      const isFinal = last?.isFinal ?? true;
      if (text && isFinal) onTranscript(text);
    };

    recognition.onerror = (event) => {
      setError(`Recording error: ${event.error}`);
    };

    recognition.onend = () => {
      clearTimer();
      setRecording(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);

    timerRef.current = setInterval(() => {
      setElapsedSec((prev) => {
        const next = prev + 1;
        if (next >= maxMinutes * 60) {
          stop();
        }
        return next;
      });
    }, 1000);
  }

  useEffect(() => {
    return () => {
      clearTimer();
      recognitionRef.current?.stop();
    };
  }, []);

  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        disabled={disabled || !SpeechRecognition}
        onClick={recording ? stop : start}
        style={{
          padding: "8px 12px",
          borderRadius: 10,
          border: "1px solid #ddd",
          background: recording ? "#fff4f4" : "white",
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        {recording ? `Stop recording (${formatElapsed(elapsedSec)})` : `Record meeting (up to ${maxMinutes} min)`}
      </button>
      {error && <div style={{ marginTop: 6, color: "crimson", fontSize: 12 }}>{error}</div>}
    </div>
  );
}
