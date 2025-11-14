"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

interface Props {
  children?: React.ReactNode;
  className?: string;
  containerClassName?: string;
}

export const BackgroundGradientAnimation = ({
  children,
  className,
  containerClassName,
}: Props) => {
  const [mounted, setMounted] = useState(false);
  const blobRef = useRef<HTMLDivElement>(null);

  // Mount check (avoid SSR document issues)
  useEffect(() => {
    setMounted(true);
  }, []);

  // DOM update (now safe — only runs when mounted === true)
  useEffect(() => {
    if (!mounted) return;

    document.body.style.setProperty(
      "--gradient-background-start",
      "rgb(108,0,162)"
    );
    document.body.style.setProperty(
      "--gradient-background-end",
      "rgb(0,17,82)"
    );
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div
      className={cn(
        "absolute w-full h-full overflow-hidden top-0 left-0 bg-[linear-gradient(40deg,var(--gradient-background-start),var(--gradient-background-end))]",
        containerClassName
      )}
    >
      <div className={className}>{children}</div>

      {/* single animated blob */}
      <div
        ref={blobRef}
        className="absolute w-40 h-40 rounded-full bg-purple-500 opacity-30 blur-2xl pointer-events-none 
        top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
      />
    </div>
  );
};
