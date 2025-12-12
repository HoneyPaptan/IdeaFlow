"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, Mic, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const sampleIdea =
  "Listen to the user's idea, transcribe it, break it into tasks, detect dependencies, validate the sequence, and render a connected flow with execution notes and a debug console.";

export default function Home() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = () => {
    if (isLoading) return;
    const payload = idea.trim() || sampleIdea;
    setIsLoading(true);

    // Show a transient loading screen, then transition to the canvas page.
    setTimeout(() => {
      router.push(`/canvas?idea=${encodeURIComponent(payload)}`);
    }, 700);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
        <div className="mb-6 flex items-center gap-3 text-sm uppercase tracking-[0.2em] text-zinc-500">
          <Sparkles className="size-4 text-amber-400" />
          Structuring your idea into a connected flow
        </div>
        <div className="flex items-center gap-3 rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2">
          <Loader2 className="size-4 animate-spin text-white" />
          <span className="text-sm text-zinc-200">Building canvas…</span>
        </div>
        <p className="mt-4 text-xs text-zinc-500">
          We&apos;ll auto-validate dependencies and prep the React Flow canvas.
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-black text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(80,80,80,0.15),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(80,80,80,0.12),transparent_35%),radial-gradient(circle_at_50%_80%,rgba(60,60,60,0.12),transparent_35%)]" />
      <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-10 px-6 py-16">
        <div className="flex flex-col gap-4">
          <Badge
            variant="outline"
            className="w-fit border-zinc-800 bg-zinc-900/60 px-3 py-1 text-xs uppercase tracking-[0.2em] text-zinc-300"
          >
            Conversational workflow OS
          </Badge>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            Turn any idea into a connected, execution-ready flow.
          </h1>
          <p className="max-w-3xl text-lg text-zinc-400">
            Describe what you want. We transcribe, segment, validate, and render a React Flow
            canvas that you can run, debug, and export. Built with shadcn and tuned for the Vercel
            dark aesthetic.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
            <div className="flex items-center gap-2">
              <Check className="size-4 text-emerald-400" />
              Voice/text capture
            </div>
            <div className="flex items-center gap-2">
              <Check className="size-4 text-emerald-400" />
              Dependency validation
            </div>
            <div className="flex items-center gap-2">
              <Check className="size-4 text-emerald-400" />
              Debug trace & export
            </div>
            <div className="flex items-center gap-2">
              <Check className="size-4 text-emerald-400" />
              Full-screen React Flow
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-zinc-900 bg-zinc-950/80 p-6 shadow-xl shadow-black/40 backdrop-blur">
          <label className="text-sm font-medium text-zinc-200" htmlFor="idea">
            Describe your workflow
          </label>
          <Input
            id="idea"
            value={idea}
            onChange={(event) => setIdea(event.target.value)}
            placeholder={sampleIdea}
            className="h-14 border-zinc-800 bg-black text-base text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-zinc-500"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleGenerate}
              className="gap-2 bg-white text-black hover:bg-zinc-200"
            >
              <ArrowRight className="size-4" />
              Generate flow
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-zinc-800 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
              onClick={() => setIdea(sampleIdea)}
            >
              <Sparkles className="size-4 text-amber-400" />
              Use sample idea
            </Button>
            <Button
              variant="ghost"
              className="gap-2 text-zinc-400 hover:bg-zinc-900"
              disabled
              title="Voice capture coming soon"
            >
              <Mic className="size-4" />
              Voice (soon)
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
