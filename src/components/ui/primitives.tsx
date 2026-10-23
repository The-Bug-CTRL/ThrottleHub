import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { RoostLoader } from "@/components/loading/roost-loader";
import type { ButtonHTMLAttributes, ReactNode } from "react";
export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet";
}) {
  return (
    <button
      className={`${variant === "primary" ? "button" : variant === "quiet" ? "text-button" : "button-secondary"} ${className}`}
      {...props}
    />
  );
}
export function SectionHeading({
  eyebrow,
  title,
  description,
  href,
  label,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {href && (
        <Link href={href}>
          {label}
          <ArrowUpRight size={17} />
        </Link>
      )}
    </div>
  );
}
export function LoadingState({
  label = "Loading…",
  size = 112,
}: {
  label?: string;
  size?: "small" | "large" | number;
}) {
  return (
    <div
      className={`loading-state${typeof size === "number" && size <= 64 ? " loading-state-compact" : ""}`}
    >
      <RoostLoader size={size} label={label} />
      <span aria-hidden="true">{label}</span>
    </div>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning";
}) {
  return (
    <span
      className={`status-badge ${tone === "success" ? "recovered" : tone === "warning" ? "warning" : ""}`}
    >
      {children}
    </span>
  );
}
