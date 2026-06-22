import Link from "next/link";
import { clsx } from "clsx";

/**
 * GAFFER — the flat-cap mark. The gaffer is the manager on the touchline;
 * the cap is his signature. Two-tone grass for depth, a single chalk button.
 */
export function GafferMark({ className, color }: { className?: string; color?: string }) {
  // Brand default uses the grass gradient; crests pass a solid color.
  const crown = color ?? "url(#cap-crown)";
  const brim = color ?? "#00A344";
  return (
    <svg viewBox="0 0 48 40" className={className} role="img" aria-label="Gaffer">
      {!color && (
        <defs>
          <linearGradient id="cap-crown" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0AE065" />
            <stop offset="100%" stopColor="#00B84A" />
          </linearGradient>
        </defs>
      )}
      {/* crown */}
      <path d="M12 25 C12 13 20.5 8 27 8 C36.5 8 42 15 42 25 Z" fill={crown} />
      {/* button */}
      <circle cx="27" cy="8" r="2.1" fill={crown} />
      <circle cx="27" cy="8" r="0.9" fill="#0A1628" opacity="0.55" />
      {/* peak / brim sweeping left */}
      <path
        d="M16.5 25 C9 24.5 3.5 26.4 2 28.6 C1.7 29.6 5 28.8 9.5 27.7 C13.5 26.7 15.5 26 18 25.4 Z"
        fill={brim}
        fillOpacity={color ? 0.7 : 1}
      />
      {/* band highlight where crown meets brim */}
      <path d="M12 25 L42 25" stroke="#0A1628" strokeWidth="0.6" opacity="0.25" />
    </svg>
  );
}

export function Logo({
  className,
  href = "/",
  size = "md",
}: {
  className?: string;
  href?: string;
  size?: "sm" | "md" | "lg";
}) {
  const mark = size === "lg" ? "h-9 w-11" : size === "sm" ? "h-6 w-7" : "h-7 w-9";
  const word = size === "lg" ? "text-4xl" : size === "sm" ? "text-2xl" : "text-3xl";
  return (
    <Link
      href={href}
      className={clsx("group inline-flex items-center gap-2.5", className)}
      aria-label="Gaffer home"
    >
      <GafferMark className={clsx(mark, "transition-transform duration-300 group-hover:-translate-y-0.5")} />
      <span className={clsx("display leading-none text-chalk tracking-[0.04em]", word)}>
        GAFFER<span className="text-grass">.</span>
      </span>
    </Link>
  );
}
