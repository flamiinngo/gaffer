"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyBlock({ command, output }: { command: string; output?: string[] }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="overflow-hidden rounded-[var(--radius-data)] border border-line bg-pitch">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <code className="mono truncate text-[13px] text-chalk">
          <span className="select-none text-grass">$ </span>
          {command}
        </code>
        <button
          onClick={copy}
          aria-label="Copy command"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[4px] border border-line px-2 py-1 text-[11px] text-data transition-colors hover:border-grass/50 hover:text-grass"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-grass" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {output && output.length > 0 && (
        <div className="mono border-t border-line/60 bg-pitch-2 px-4 py-2.5 text-[12.5px] leading-relaxed text-data">
          {output.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}
