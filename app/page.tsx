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
import DarkVeil from "@/components/DarkVeil";
import { toast } from "sonner";

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
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [useCloudKeys, setUseCloudKeys] = useState(false);
  const [hasCloudKeysAvailable, setHasCloudKeysAvailable] = useState(false);
  const [apiKeysChecked, setApiKeysChecked] = useState(false);
  const [pendingGeneration, setPendingGeneration] = useState(false);

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
      const [keysRes, cloudRes] = await Promise.all([
        fetch("/api/settings/keys", {
          headers: {
            "x-session-id": getSessionId(),
          },
        }),
        fetch("/api/settings/keys/check-cloud", {
          headers: {
            "x-session-id": getSessionId(),
          },
        }),
      ]);
      
      const keysData = await keysRes.json();
      const cloudData = await cloudRes.json();
      
      if (keysData.success) {
        setHasGroqKey(keysData.hasGroq || false);
        setHasOpenrouterKey(keysData.hasOpenrouter || false);
      }
      
      if (cloudData.success) {
        setHasCloudKeysAvailable(cloudData.hasCloudKeys || false);
      }
      
      setApiKeysChecked(true);
    } catch {
      // Ignore errors
      setApiKeysChecked(true);
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
        
        // If there's a pending generation (e.g., from voice input), mark it
        // The useEffect below will handle the actual generation
        if (pendingGeneration) {
          // Keep pendingGeneration true, useEffect will handle it
        }
      } else {
        setError(`Failed to save keys: ${data.error || "unknown error"}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setError(`Failed to save keys: ${message}`);
    } finally {
      setIsSavingKeys(false);
    }
  }, [groqKey, openrouterKey, getSessionId, loadApiKeysStatus, idea, pendingGeneration]);

  useEffect(() => {
    if (settingsOpen) {
      loadApiKeysStatus();
    }
  }, [settingsOpen, loadApiKeysStatus]);

  // Pre-check API keys on mount
  useEffect(() => {
    loadApiKeysStatus();
  }, [loadApiKeysStatus]);

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

  // Normalize input for cache key (lowercase, remove all spaces)
  const normalizeInput = (text: string): string => {
    return text.trim().toLowerCase().replace(/\s+/g, '');
  };

  // Check if workflow exists in cache
  const getCachedWorkflow = (normalizedKey: string): WorkflowGraph | null => {
    try {
      const cacheKey = `workflow-cache:${normalizedKey}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        return JSON.parse(cached) as WorkflowGraph;
      }
    } catch (err) {
      console.warn("[landing] failed to load cache", err);
    }
    return null;
  };

  const validateInput = (text: string): boolean => {
    // Fast client-side validation only - no API calls
    if (text.length < 10) return false;
    
    // Clean and extract words (remove punctuation, filter by length)
    const words = text
      .trim()
      .split(/\s+/)
      .map(w => w.replace(/[^\w]/g, '')) // Remove punctuation
      .filter(w => w.length > 2); // Only keep words longer than 2 chars
    
    if (words.length < 2) return false;
    
    // Check for excessive repetition (likely gibberish)
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    
    // If there's only 1 unique word but multiple words total, it's repetition
    // e.g., "hello hello" or "test test test"
    if (uniqueWords.size === 1 && words.length >= 2) return false;
    
    // If there are very few unique words compared to total words, it's likely repetition
    // e.g., "hello hello hello" or "test test test test"
    if (uniqueWords.size < 2 && words.length >= 3) return false;
    
    // Check for simple repetition patterns like "word, word" or "word word word"
    const wordArray = words.map(w => w.toLowerCase());
    const firstWord = wordArray[0];
    if (wordArray.length >= 2 && wordArray.every(w => w === firstWord)) {
      return false; // All words are the same
    }
    
    // Check for common patterns that indicate gibberish
    const hasRepeatingPattern = /(.)\1{4,}/.test(text); // Same character repeated 5+ times
    if (hasRepeatingPattern) return false;
    
    // Check if it's mostly numbers or special characters
    const alphanumericRatio = text.replace(/[^a-zA-Z0-9\s]/g, '').length / text.length;
    if (alphanumericRatio < 0.5) return false;
    
    // Check for very short unique word count (e.g., "hi hi hi" or "yes yes")
    if (uniqueWords.size === 1) return false;
    
    return true;
  };

  const checkApiKeys = (): boolean => {
    // Use cached status - no API calls
    // If user has keys, they're good to go
    if (hasGroqKey && hasOpenrouterKey) {
      return true;
    }
    
    // If cloud keys are available, show modal to choose
    if (hasCloudKeysAvailable) {
      setApiKeyModalOpen(true);
      return false; // Wait for user decision
    }
    
    // No keys at all - show modal
    setApiKeyModalOpen(true);
    return false;
  };

  const proceedWithGeneration = async (skipValidation = false, skipKeyCheck = false) => {
    const trimmed = idea.trim();
    if (!trimmed) return;
    
    // Normalize input for cache lookup
    const normalizedKey = normalizeInput(trimmed);
    
    // Check cache first - if exists, navigate immediately
    const cachedWorkflow = getCachedWorkflow(normalizedKey);
    if (cachedWorkflow) {
      console.debug("[landing] found cached workflow, navigating immediately");
      sessionStorage.setItem(
        "prefetched-workflow",
        JSON.stringify({ idea: trimmed, graph: cachedWorkflow }),
      );
      sessionStorage.setItem("workflow-prefetch-complete", "true");
      
      // Navigate immediately without API calls
      const encoded = encodeURIComponent(trimmed);
      router.push(`/canvas?idea=${encoded}`);
      return;
    }
    
    // Validate input first (unless skipped) - fast client-side check
    if (!skipValidation) {
      const isValid = validateInput(trimmed);
      if (!isValid) {
        toast.error("Please write a meaningful idea", {
          description: "Your input doesn't seem to be a valid idea. Please try again with a clear description.",
        });
        setIsLoading(false);
        return;
      }
    }
    
    // Check API keys (unless skipped) - instant check using cached status
    if (!skipKeyCheck) {
      // If keys haven't been checked yet, do a quick check
      if (!apiKeysChecked) {
        await loadApiKeysStatus();
      }
      
      const hasKeys = checkApiKeys();
      if (!hasKeys && !useCloudKeys) {
        // Modal is open, wait for user to choose
        return;
      }
    }
    
    setIsLoading(true);
    setError(null);

    // Prefetch workflow via API so canvas can load instantly
    try {
      console.debug("[landing] parsing idea via API");
      const result = await parseIdea(trimmed);
      
      // Check for rate limit error
      if (!result.success && result.error?.includes("Rate limit exceeded")) {
        const resetIn = (result as any).rateLimit?.resetIn || 60;
        toast.error("Rate limit exceeded", {
          description: `You've reached the limit of 2 requests per minute. Please wait ${resetIn} seconds or use your own API keys in Settings to avoid rate limiting.`,
          duration: 5000,
        });
        setIsLoading(false);
        return;
      }
      
      if (result.success && result.graph) {
        console.debug("[landing] parse success", {
          nodes: result.graph.nodes.length,
          edges: result.graph.edges.length,
        });
        
        // Save to cache with normalized key
        try {
          const cacheKey = `workflow-cache:${normalizedKey}`;
          localStorage.setItem(cacheKey, JSON.stringify(result.graph));
        } catch (err) {
          console.warn("[landing] failed to cache workflow", err);
        }
        
        sessionStorage.setItem(
          "prefetched-workflow",
          JSON.stringify({ idea: trimmed, graph: result.graph }),
        );
        // Mark that prefetch is complete so canvas knows not to show loading
        sessionStorage.setItem("workflow-prefetch-complete", "true");
      } else {
        console.warn("[landing] parse failed, falling back on canvas", result.error);
        toast.error("Failed to generate workflow", {
          description: result.error || "Unknown error occurred",
        });
        setIsLoading(false);
        sessionStorage.removeItem("prefetched-workflow");
        sessionStorage.removeItem("workflow-prefetch-complete");
        return;
      }
    } catch (err) {
      console.error("[landing] parse error", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      
      // Check if it's a rate limit error from fetch
      if (errorMessage.includes("429") || errorMessage.includes("Rate limit")) {
        toast.error("Rate limit exceeded", {
          description: "You've reached the limit of 2 requests per minute. Please wait or use your own API keys in Settings to avoid rate limiting.",
          duration: 5000,
        });
      } else {
        toast.error("Could not generate workflow", {
          description: errorMessage,
        });
      }
      setIsLoading(false);
      sessionStorage.removeItem("prefetched-workflow");
      sessionStorage.removeItem("workflow-prefetch-complete");
      return;
    }
    
    // Navigate to canvas - keep loading screen visible during navigation
    // The canvas page will handle removing the loading state once it's ready
    const encoded = encodeURIComponent(trimmed);
    router.push(`/canvas?idea=${encoded}`);
    // Don't set isLoading to false here - let canvas page handle it
  };

  const handleGenerate = async () => {
    await proceedWithGeneration();
  };

  const handleContinueWithCloud = async () => {
    setUseCloudKeys(true);
    setApiKeyModalOpen(false);
    // Proceed with generation, skipping key check since user chose cloud
    // Validation is already done, so skip that too
    await proceedWithGeneration(true, true);
  };

  const handleAddKeys = () => {
    setApiKeyModalOpen(false);
    setSettingsOpen(true);
  };

  // Handle pending generation after keys are saved
  useEffect(() => {
    if (pendingGeneration && hasGroqKey && hasOpenrouterKey && idea.trim()) {
      const trimmed = idea.trim();
      if (validateInput(trimmed)) {
        setPendingGeneration(false);
        // Small delay to ensure state is fully updated
        setTimeout(() => {
          proceedWithGeneration(true, true);
        }, 100);
      }
    }
  }, [pendingGeneration, hasGroqKey, hasOpenrouterKey, idea]);

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
            className="text-3xl font-bold font-sans tracking-tight"
            interval={1500}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black px-4">
      {/* DarkVeil Background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <DarkVeil
          hueShift={0}
          noiseIntensity={0.02}
          scanlineIntensity={0.1}
          speed={0.3}
          scanlineFrequency={2.0}
          warpAmount={0.1}
          resolutionScale={1}
        />
      </div>

      {/* Background effects overlay */}
      <div className="pointer-events-none absolute inset-0 z-0">
        {/* Gradient orbs for depth */}
        <div className="absolute left-1/2 top-0 size-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-b from-zinc-800/20 to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-1/4 size-[400px] translate-y-1/2 rounded-full bg-gradient-to-t from-violet-900/10 to-transparent blur-3xl" />
        <div className="absolute bottom-0 right-1/4 size-[400px] translate-y-1/2 rounded-full bg-gradient-to-t from-blue-900/10 to-transparent blur-3xl" />
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
      <main className="relative z-10 flex w-full max-w-2xl flex-col items-center justify-center text-center py-12">
        {/* Headline */}
        <h1 className="text-4xl leading-7 font-bold font-sans tracking-tight tracking-tight text-white sm:text-5xl md:text-6xl sm:leading-10 md:leading-12">
          Transform ideas into
          <span className="mt-1 block bg-gradient-to-r from-zinc-200 via-zinc-400 to-zinc-500 bg-clip-text text-transparent">
            actionable workflows
          </span>
        </h1>

        {/* Subheadline */}
        <p className="mx-auto mt-5 leading-4 max-w-lg text-sm text-zinc-500 sm:text-base">
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
                placeholder="Share your idea... We'll suggest actionable tasks you can do right now"
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
                  title="Voice input"
                >
                  <Mic className="size-4" />
                </Button>
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

          {/* API Key Check Modal */}
          <Dialog open={apiKeyModalOpen} onOpenChange={setApiKeyModalOpen}>
            <DialogContent className="max-w-md border-zinc-800 bg-zinc-950 text-zinc-100">
              <DialogHeader>
                <DialogTitle>API Keys Required</DialogTitle>
                <DialogDescription className="text-zinc-400">
                  To generate workflows, you need API keys for Groq and OpenRouter. Choose an option below.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-3">
                  <Button
                    onClick={handleAddKeys}
                    className="w-full bg-white text-black hover:bg-zinc-200"
                  >
                    Add My API Keys
                  </Button>
                  <Button
                    onClick={handleContinueWithCloud}
                    variant="outline"
                    className="w-full border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                  >
                    Continue with Cloud Keys
                  </Button>
                </div>
                <p className="text-xs text-zinc-500 text-center">
                  Cloud keys use the server&apos;s environment variables. Your own keys give you more control and usage limits.
                </p>
              </div>
            </DialogContent>
          </Dialog>

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
              
              // Close voice modal first
              setVoiceModalOpen(false);
              
              // Set the transcribed text
              setIdea(transcribedText);
              
              // Validate the transcribed text
              const trimmed = transcribedText.trim();
              if (!trimmed) {
                toast.error("No speech detected", {
                  description: "Please try speaking your idea again.",
                });
                return;
              }
              
              // Normalize and check cache first
              const normalizedKey = normalizeInput(trimmed);
              const cachedWorkflow = getCachedWorkflow(normalizedKey);
              if (cachedWorkflow) {
                console.debug("[landing] found cached workflow from voice, navigating immediately");
                sessionStorage.setItem(
                  "prefetched-workflow",
                  JSON.stringify({ idea: trimmed, graph: cachedWorkflow }),
                );
                sessionStorage.setItem("workflow-prefetch-complete", "true");
                
                // Navigate immediately without API calls
                const encoded = encodeURIComponent(trimmed);
                router.push(`/canvas?idea=${encoded}`);
                return;
              }
              
              const isValid = validateInput(trimmed);
              if (!isValid) {
                toast.error("Please speak a meaningful idea", {
                  description: "Your transcribed text doesn't seem to be a valid idea. Please try again with a clear description.",
                });
                return;
              }
              
              // Check API keys
              if (!apiKeysChecked) {
                await loadApiKeysStatus();
              }
              
              const hasKeys = checkApiKeys();
              if (!hasKeys && !useCloudKeys) {
                // Modal will open, wait for user to choose
                // Mark that we have a pending generation so we can proceed after keys are added
                setPendingGeneration(true);
                return;
              }
              
              // If we have keys or user chose cloud, proceed with generation
              // Use the same proceedWithGeneration function but skip validation and key check
              // since we already did them
              await proceedWithGeneration(true, true);
            }}
            onError={(errorMessage) => {
              console.error("[landing] voice error:", errorMessage);
              setError(errorMessage);
              toast.error("Voice transcription failed", {
                description: errorMessage,
              });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
