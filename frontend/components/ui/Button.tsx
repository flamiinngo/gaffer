import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";

const button = cva(
  "inline-flex items-center justify-center gap-2 font-semibold tracking-tight rounded-[var(--radius-data)] transition-all duration-200 ease-[var(--ease-out-quint)] focus-visible:outline-2 focus-visible:outline-grass disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-grass text-pitch hover:bg-[color-mix(in_srgb,var(--color-grass)_85%,white)] hover:shadow-[0_0_28px_rgba(0,200,83,0.35)] active:translate-y-px",
        gold:
          "bg-gold text-pitch hover:brightness-105 hover:shadow-[0_0_28px_rgba(255,183,0,0.3)] active:translate-y-px",
        ghost:
          "border border-line text-chalk hover:border-grass/50 hover:bg-grass/5 active:translate-y-px",
        danger:
          "bg-danger/10 text-danger border border-danger/40 hover:bg-danger/20 active:translate-y-px",
        subtle:
          "bg-midfield text-chalk border border-line hover:border-data/60 active:translate-y-px",
      },
      size: {
        sm: "h-9 px-3.5 text-sm",
        md: "h-11 px-5 text-[15px]",
        lg: "h-14 px-7 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

type BaseProps = VariantProps<typeof button> & { className?: string };

type ButtonProps = BaseProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type AnchorProps = BaseProps &
  Omit<React.ComponentProps<typeof Link>, "className"> & { href: string };

export function Button(props: ButtonProps | AnchorProps) {
  const { variant, size, className } = props;
  const classes = clsx(button({ variant, size }), className);

  if ("href" in props && props.href !== undefined) {
    const { variant: _v, size: _s, className: _c, ...rest } = props;
    return <Link className={classes} {...rest} />;
  }
  const { variant: _v, size: _s, className: _c, href: _h, ...rest } =
    props as ButtonProps;
  return <button className={classes} {...rest} />;
}
