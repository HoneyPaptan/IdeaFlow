"use client";

import { Mic, Square } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type VoiceRecorderProps = {
  onTranscriptionComplete: (text: string) => void;
  onError?: (error: string) => void;
  autoStart?: boolean;
};

export function VoiceRecorder({
  onTranscriptionComplete,
  onError,
  autoStart = false,
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [time, setTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (autoStart && !isRecording && !isTranscribing) {
      handleStartRecording();
    }
  }, [autoStart]);

  useEffect(() => {
    if (isRecording) {
      intervalRef.current = setInterval(() => {
        setTime((t) => t + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        await handleTranscription();
      };

      mediaRecorder.start();
      setIsRecording(true);
      setTime(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to access microphone";
      onError?.(message);
      console.error("Recording error:", error);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const getSessionId = (): string => {
    if (typeof window === "undefined") return "default";
    let sessionId = sessionStorage.getItem("session-id");
    if (!sessionId) {
      sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem("session-id", sessionId);
    }
    return sessionId;
  };

  const handleTranscription = async () => {
    if (audioChunksRef.current.length === 0) {
      onError?.("No audio recorded");
      return;
    }

    setIsTranscribing(true);
    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("file", audioBlob, "recording.webm");

      const response = await fetch("/api/voice/transcribe", {
        method: "POST",
        headers: {
          "x-session-id": getSessionId(),
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Transcription failed");
      }

      const data = await response.json();
      if (data.success && data.text) {
        onTranscriptionComplete(data.text.trim());
      } else {
        throw new Error(data.error || "No transcription received");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Transcription failed";
      onError?.(message);
      console.error("Transcription error:", error);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleToggle = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  };

  return (
    <div className="w-full py-4">
      <div className="relative max-w-xl w-full mx-auto flex items-center flex-col gap-2">
        <button
          className={cn(
            "group w-16 h-16 rounded-xl flex items-center justify-center transition-colors",
            isRecording || isTranscribing
              ? "bg-none"
              : "bg-none hover:bg-black/5 dark:hover:bg-white/5"
          )}
          type="button"
          onClick={handleToggle}
          disabled={isTranscribing}
        >
          {isTranscribing ? (
            <div
              className="w-6 h-6 rounded-sm animate-spin bg-black dark:bg-white cursor-pointer pointer-events-auto"
              style={{ animationDuration: "3s" }}
            />
          ) : isRecording ? (
            <Square className="w-6 h-6 text-rose-500" />
          ) : (
            <Mic className="w-6 h-6 text-black/90 dark:text-white/90" />
          )}
        </button>

        <span
          className={cn(
            "font-mono text-sm transition-opacity duration-300",
            isRecording || isTranscribing
              ? "text-black/70 dark:text-white/70"
              : "text-black/30 dark:text-white/30"
          )}
        >
          {formatTime(time)}
        </span>

        <div className="h-4 w-64 flex items-center justify-center gap-0.5">
          {[...Array(48)].map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-0.5 rounded-full transition-all duration-300",
                isRecording
                  ? "bg-black/50 dark:bg-white/50 animate-pulse"
                  : "bg-black/10 dark:bg-white/10 h-1"
              )}
              style={
                isRecording
                  ? {
                        height: `${20 + Math.random() * 80}%`,
                        animationDelay: `${i * 0.05}s`,
                      }
                  : undefined
              }
            />
          ))}
        </div>

        <p className="h-4 text-xs text-black/70 dark:text-white/70">
          {isTranscribing
            ? "Transcribing..."
            : isRecording
            ? "Listening... Click stop when done"
            : "Click to start recording"}
        </p>
      </div>
    </div>
  );
}

