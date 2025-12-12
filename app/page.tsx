"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Mic, Settings, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { VoiceRecorder } from "@/components/voice-recorder";
import { parseIdea } from "@/lib/workflow-api";

export default function Home() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [groqKey, setGroqKey] = useState("");
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [hasGroqKey, setHasGroqKey] = useState(false);
  const [hasOpenrouterKey, setHasOpenrouterKey] = useState(false);
  const [isSavingKeys, setIsSavingKeys] = useState(false);

  const getSessionId = useCallback((): string => {
    if (typeof window === "undefined") return "default";
    let sessionId = sessionStorage.getItem("session-id");
    if (!sessionId) {
      sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem("session-id", sessionId);
    }
    return sessionId;
  }, []);

  const loadApiKeysStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/keys", {
        headers: {
          "x-session-id": getSessionId(),
        },
      });
      const data = await res.json();
      if (data.success) {
        setHasGroqKey(data.hasGroq || false);
        setHasOpenrouterKey(data.hasOpenrouter || false);
      }
    } catch {
      // Ignore errors
    }
  }, [getSessionId]);

  const saveApiKeys = useCallback(async () => {
    if (!groqKey.trim() && !openrouterKey.trim()) {
      setError("Please enter at least one API key");
      return;
    }

    setIsSavingKeys(true);
    try {
      const res = await fetch("/api/settings/keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": getSessionId(),
        },
        body: JSON.stringify({
          groqKey: groqKey.trim() || undefined,
          openrouterKey: openrouterKey.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setGroqKey("");
        setOpenrouterKey("");
        await loadApiKeysStatus();
        setSettingsOpen(false);
        setError(null);
      } else {
        setError(`Failed to save keys: ${data.error || "unknown error"}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setError(`Failed to save keys: ${message}`);
    } finally {
      setIsSavingKeys(false);
    }
  }, [groqKey, openrouterKey, getSessionId, loadApiKeysStatus]);

  useEffect(() => {
    if (settingsOpen) {
      loadApiKeysStatus();
    }
  }, [settingsOpen, loadApiKeysStatus]);

  const handleGenerate = async () => {
    const trimmed = idea.trim();
    if (!trimmed) return;
    setIsLoading(true);
    setError(null);

    // Prefetch workflow via API so canvas can load instantly
    try {
      console.debug("[landing] parsing idea via API");
      const result = await parseIdea(trimmed);
      if (result.success && result.graph) {
        console.debug("[landing] parse success", {
          nodes: result.graph.nodes.length,
          edges: result.graph.edges.length,
        });
        sessionStorage.setItem(
          "prefetched-workflow",
          JSON.stringify({ idea: trimmed, graph: result.graph }),
        );
      } else {
        console.warn("[landing] parse failed, falling back on canvas", result.error);
        sessionStorage.removeItem("prefetched-workflow");
      }
    } catch (err) {
      console.error("[landing] parse error", err);
      setError("Could not prefetch workflow, will try on canvas.");
      sessionStorage.removeItem("prefetched-workflow");
    } finally {
      setIsLoading(false);
      const encoded = encodeURIComponent(trimmed);
      router.push(`/canvas?idea=${encoded}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  // Full-screen loading overlay
  if (isLoading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 bg-black">
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -left-1/4 top-1/4 size-[600px] rounded-full bg-gradient-to-r from-violet-600/20 to-transparent blur-3xl" />
          <div className="absolute -right-1/4 bottom-1/4 size-[600px] rounded-full bg-gradient-to-l from-blue-600/20 to-transparent blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-full bg-white/20" />
              <div className="relative flex size-16 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950">
                <Loader2 className="size-8 animate-spin text-white" />
              </div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-lg font-medium text-zinc-100">
              Generating your workflow
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Analyzing structure and dependencies...
            </p>
          </div>

          {/* Progress dots */}
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="size-1.5 animate-pulse rounded-full bg-zinc-600"
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black px-4">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0">
        {/* Gradient orbs */}
        <div className="absolute left-1/2 top-0 size-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-b from-zinc-800/30 to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-1/4 size-[400px] translate-y-1/2 rounded-full bg-gradient-to-t from-violet-900/20 to-transparent blur-3xl" />
        <div className="absolute bottom-0 right-1/4 size-[400px] translate-y-1/2 rounded-full bg-gradient-to-t from-blue-900/20 to-transparent blur-3xl" />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(to right, white 1px, transparent 1px), 
                             linear-gradient(to bottom, white 1px, transparent 1px)`,
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      {/* Settings Button */}
      <div className="absolute top-4 right-4 z-20">
        <Drawer open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DrawerTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-lg border border-zinc-800 bg-zinc-950/80 text-zinc-400 backdrop-blur hover:bg-zinc-800 hover:text-zinc-300"
            >
              <Settings className="size-4" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
            <DrawerHeader>
              <DrawerTitle>Settings</DrawerTitle>
              <DrawerDescription>Manage your API keys for workflow generation.</DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-4 space-y-6">
              {/* API Keys Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-zinc-300">API Keys</h3>
                <p className="text-xs text-zinc-500">
                  Add your API keys here if you want to use your own instead of environment variables.
                </p>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-400">Groq API Key</label>
                    <Input
                      type="password"
                      value={groqKey}
                      onChange={(e) => setGroqKey(e.target.value)}
                      placeholder={hasGroqKey ? "••••••••••••••••" : "Enter Groq API key"}
                      className="border-zinc-800 bg-zinc-900 text-zinc-100"
                    />
                    {hasGroqKey && !groqKey && (
                      <p className="text-xs text-zinc-500">Key is saved. Enter a new key to update.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-400">OpenRouter API Key</label>
                    <Input
                      type="password"
                      value={openrouterKey}
                      onChange={(e) => setOpenrouterKey(e.target.value)}
                      placeholder={hasOpenrouterKey ? "••••••••••••••••" : "Enter OpenRouter API key"}
                      className="border-zinc-800 bg-zinc-900 text-zinc-100"
                    />
                    {hasOpenrouterKey && !openrouterKey && (
                      <p className="text-xs text-zinc-500">Key is saved. Enter a new key to update.</p>
                    )}
                  </div>
                  <Button
                    onClick={saveApiKeys}
                    disabled={isSavingKeys}
                    className="w-full bg-white text-black hover:bg-zinc-200"
                  >
                    {isSavingKeys ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save API Keys"
                    )}
                  </Button>
                </div>
              </div>
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="ghost" className="w-full">
                  Close
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>

      {/* Content */}
      <main className="relative z-10 flex w-full max-w-2xl flex-col items-center text-center">
        {/* Badge */}
        <div className="mb-8 flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/80 px-4 py-1.5 text-xs text-zinc-400 backdrop-blur">
          <Sparkles className="size-3.5 text-amber-400" />
          <span>AI-Powered Workflow Builder</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
          Transform ideas into
          <span className="mt-2 block bg-gradient-to-r from-zinc-200 via-zinc-400 to-zinc-500 bg-clip-text text-transparent">
            actionable workflows
          </span>
        </h1>

        {/* Subheadline */}
        <p className="mx-auto mt-6 max-w-lg text-base text-zinc-500 sm:text-lg">
          Describe your idea in plain language. We&apos;ll generate a visual, connected
          workflow that you can execute, edit, and export.
        </p>

        {/* Input area */}
        <div className="mt-10 w-full">
          <div className="group relative rounded-xl border border-zinc-800 bg-zinc-950/80 p-1 shadow-2xl shadow-black/50 backdrop-blur transition-all focus-within:border-zinc-700 focus-within:ring-1 focus-within:ring-zinc-700">
            <div className="flex items-start gap-2 p-3">
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your workflow... e.g., 'Create a customer onboarding flow that sends welcome email, assigns account manager, schedules demo call'"
                className="min-h-[80px] flex-1 resize-none bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between border-t border-zinc-800/50 px-3 py-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                  onClick={() => setVoiceModalOpen(true)}
                >
                  <Mic className="size-4" />
                </Button>
                <span className="text-xs text-zinc-600">Voice input</span>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={!idea.trim()}
                className="gap-2 bg-white text-black hover:bg-zinc-200 disabled:opacity-50"
              >
                Generate
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>

          {error && (
            <p className="mt-3 text-center text-xs text-amber-400">{error}</p>
          )}
          {/* Hints */}
          <p className="mt-3 text-center text-xs text-zinc-600">
            Press Enter to generate • Shift+Enter for new line
          </p>
        </div>

        {/* Example prompts */}
        <div className="mt-12 flex flex-wrap justify-center gap-2">
          {[
            "Customer onboarding flow",
            "Content approval pipeline",
            "Bug triage process",
          ].map((example) => (
            <button
              key={example}
              onClick={() => setIdea(example)}
              className="rounded-full border border-zinc-800 bg-zinc-950/50 px-3 py-1.5 text-xs text-zinc-500 transition-colors hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-300"
            >
              {example}
            </button>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="absolute bottom-6 left-0 right-0 text-center">
        <p className="text-xs text-zinc-700">
          Built with Next.js, React Flow, and shadcn/ui
        </p>
      </footer>

      {/* Voice Recording Modal */}
      <Dialog open={voiceModalOpen} onOpenChange={setVoiceModalOpen}>
        <DialogContent className="max-w-md border-zinc-800 bg-zinc-950 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Record your idea</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Speak your workflow idea. Click stop when you&apos;re done, and we&apos;ll generate your workflow.
            </DialogDescription>
          </DialogHeader>
          <VoiceRecorder
            autoStart={true}
            onTranscriptionComplete={async (transcribedText) => {
              console.debug("[landing] voice transcription complete:", transcribedText);
              setIdea(transcribedText);
              setVoiceModalOpen(false);
              
              // Auto-generate workflow with transcribed text
              setIsLoading(true);
              setError(null);

              try {
                console.debug("[landing] parsing transcribed idea via API");
                const result = await parseIdea(transcribedText);
                if (result.success && result.graph) {
                  console.debug("[landing] parse success", {
                    nodes: result.graph.nodes.length,
                    edges: result.graph.edges.length,
                  });
                  sessionStorage.setItem(
                    "prefetched-workflow",
                    JSON.stringify({ idea: transcribedText, graph: result.graph }),
                  );
                } else {
                  console.warn("[landing] parse failed, falling back on canvas", result.error);
                  sessionStorage.removeItem("prefetched-workflow");
                }
              } catch (err) {
                console.error("[landing] parse error", err);
                setError("Could not prefetch workflow, will try on canvas.");
                sessionStorage.removeItem("prefetched-workflow");
              } finally {
                setIsLoading(false);
                const encoded = encodeURIComponent(transcribedText);
                router.push(`/canvas?idea=${encoded}`);
              }
            }}
            onError={(errorMessage) => {
              console.error("[landing] voice error:", errorMessage);
              setError(errorMessage);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
