"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  ShieldCheck,
  Newspaper,
  CalendarDays,
  Users,
} from "lucide-react";
import { useRole } from "./use-role";
export function AdminNavigation() {
  const { admin, moderator } = useRole();
  const path = usePathname();
  if (!moderator) return null;
  const links = [
    ...(admin
      ? [{ href: "/admin", label: "Listing reports", icon: ClipboardList }]
      : []),
    {
      href: "/admin/community",
      label: "Community & stolen bikes",
      icon: ShieldCheck,
    },
    ...(admin
      ? [
          { href: "/admin/editorial", label: "Editorial", icon: Newspaper },
          { href: "/admin/events", label: "Events", icon: CalendarDays },
        ]
      : []),
    { href: "/jobs", label: "Jobs & services approval", icon: ClipboardList },
    {
      href: "/admin/community#participant-controls",
      label: "Participants",
      icon: Users,
    },
  ];
  return (
    <nav className="admin-navigation" aria-label="Administration">
      {links.map(({ href, label, icon: Icon }) => (
        <Link key={href} className={path === href ? "active" : ""} href={href}>
          <Icon size={16} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
