"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Mic, Settings, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import AITextLoading from "@/components/kokonutui/ai-text-loading";

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
  const [selectedModel, setSelectedModel] = useState<string>("meta-llama/llama-3.3-70b-instruct");

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

  // Load selected model from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedModel = localStorage.getItem("openrouter-model");
      if (savedModel) {
        setSelectedModel(savedModel);
      }
    }
  }, []);

  // Save model to localStorage when changed
  const handleModelChange = (value: string) => {
    setSelectedModel(value);
    if (typeof window !== "undefined") {
      localStorage.setItem("openrouter-model", value);
    }
  };

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
        // Mark that prefetch is complete so canvas knows not to show loading
        sessionStorage.setItem("workflow-prefetch-complete", "true");
      } else {
        console.warn("[landing] parse failed, falling back on canvas", result.error);
        sessionStorage.removeItem("prefetched-workflow");
        sessionStorage.removeItem("workflow-prefetch-complete");
      }
    } catch (err) {
      console.error("[landing] parse error", err);
      setError("Could not prefetch workflow, will try on canvas.");
      sessionStorage.removeItem("prefetched-workflow");
      sessionStorage.removeItem("workflow-prefetch-complete");
    }
    
    // Navigate to canvas - keep loading screen visible during navigation
    // The canvas page will handle removing the loading state once it's ready
    const encoded = encodeURIComponent(trimmed);
    router.push(`/canvas?idea=${encoded}`);
    // Don't set isLoading to false here - let canvas page handle it
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

        <div className="relative z-10 flex flex-col items-center justify-center">
          <AITextLoading
            texts={[
              "Generating your workflow...",
              "Analyzing structure...",
              "Detecting dependencies...",
              "Building nodes...",
          
            ]}
            className="text-3xl font-bold"
            interval={1500}
          />
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
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-400">AI Model</label>
                    <Select value={selectedModel} onValueChange={handleModelChange}>
                      <SelectTrigger className="border-zinc-800 bg-zinc-900 text-zinc-100">
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent className="border-zinc-800 bg-zinc-900 text-zinc-100">
                        <SelectItem value="google/gemini-2.5-flash-preview-09-2025">
                          Google Gemini 2.5 Flash
                        </SelectItem>
                        <SelectItem value="meta-llama/llama-3.3-70b-instruct">
                          Meta Llama 3.3 70B
                        </SelectItem>
                        <SelectItem value="openai/gpt-5">OpenAI GPT-5</SelectItem>
                      </SelectContent>
                    </Select>
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
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
          Transform ideas into
          <span className="mt-1 block bg-gradient-to-r from-zinc-200 via-zinc-400 to-zinc-500 bg-clip-text text-transparent">
            actionable workflows
          </span>
        </h1>

        {/* Subheadline */}
        <p className="mx-auto mt-3 max-w-lg text-sm text-zinc-500 sm:text-base">
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

      </main>

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
