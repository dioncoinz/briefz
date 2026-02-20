"use client";

import { useMemo, useRef, useState } from "react";

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
};

export default function SpeechToTextButton({ onTranscript, disabled }: Props) {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const SpeechRecognition = useMemo(
    () =>
      typeof window === "undefined"
        ? undefined
        : (window.SpeechRecognition || window.webkitSpeechRecognition),
    []
  );

  function start() {
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    setError(null);

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
      setError(`Speech recognition error: ${event.error}`);
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function stop() {
    recognitionRef.current?.stop();
  }

  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        disabled={disabled || !SpeechRecognition}
        onClick={listening ? stop : start}
        style={{
          padding: "8px 12px",
          borderRadius: 10,
          border: "1px solid #ddd",
          background: "white",
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        {listening ? "Stop dictation" : "Speak to text"}
      </button>
      {error && <div style={{ marginTop: 6, color: "crimson", fontSize: 12 }}>{error}</div>}
    </div>
  );
}
