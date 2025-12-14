"use client";

import { useEffect, useState } from "react";
import { Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MobileWarning() {
  const [isMobile, setIsMobile] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if device is mobile
    const checkMobile = () => {
      const isMobileDevice = 
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        ) || window.innerWidth < 768;
      setIsMobile(isMobileDevice);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (!isMobile || isDismissed) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 p-4">
      <div className="flex max-w-md flex-col items-center gap-6 rounded-xl border border-zinc-800 bg-zinc-950 p-8 text-center shadow-2xl">
        <div className="flex size-16 items-center justify-center rounded-full bg-zinc-800">
          <Monitor className="size-8 text-zinc-400" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">
            Desktop Experience Recommended
          </h2>
          <p className="text-sm text-zinc-400">
            IdeaFlow is optimized for desktop browsers. For the best experience with workflow visualization and editing, please use a desktop or laptop computer.
          </p>
        </div>

        <Button
          onClick={() => setIsDismissed(true)}
          className="w-full bg-white text-black hover:bg-zinc-200"
        >
          Continue Anyway
        </Button>
      </div>
    </div>
  );
}

