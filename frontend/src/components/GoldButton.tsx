import { ComponentProps, ReactNode } from "react";
import { Link } from "react-router-dom";

type Variant = "primary" | "ghost";

interface BaseProps {
  variant?: Variant;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-gold-600/30 to-gold-800/20 text-gold-100 border-gold-600/60 shadow-gold-glow hover:from-gold-500/40 hover:to-gold-700/30 hover:text-gold-50 hover:shadow-[0_0_44px_-4px_rgba(201,168,76,0.45)]",
  ghost:
    "bg-transparent text-stone-100 border-stone-500/40 hover:border-gold-600/50 hover:text-gold-200",
};

const BASE_CLASSES =
  "inline-flex items-center justify-center gap-3 border px-9 py-4 font-display text-[11px] uppercase tracking-carved transition-all duration-300 select-none";

interface GoldButtonAsButtonProps
  extends BaseProps,
    Omit<ComponentProps<"button">, "children"> {
  to?: never;
}

interface GoldButtonAsLinkProps extends BaseProps {
  to: string;
  external?: boolean;
}

type GoldButtonProps = GoldButtonAsButtonProps | GoldButtonAsLinkProps;

export function GoldButton(props: GoldButtonProps) {
  const variant = props.variant ?? "primary";
  const className = `${BASE_CLASSES} ${VARIANT_CLASSES[variant]}`;

  if ("to" in props && props.to !== undefined) {
    if (props.external) {
      return (
        <a
          href={props.to}
          className={className}
          target="_blank"
          rel="noreferrer"
        >
          {props.children}
        </a>
      );
    }
    return (
      <Link to={props.to} className={className}>
        {props.children}
      </Link>
    );
  }

  const { variant: _v, children, ...rest } = props as GoldButtonAsButtonProps;
  return (
    <button {...rest} className={className}>
      {children}
    </button>
  );
}
