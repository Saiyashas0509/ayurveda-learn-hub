import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Shield, User, Wrench, ClipboardCheck, Video, Bell, ClipboardList } from "lucide-react";
import type { ReactNode } from "react";

const ADMIN_TABS = [
  { to: "/admin", label: "Overview", icon: Shield },
  { to: "/admin/users", label: "Users", icon: User },
  { to: "/admin/courses", label: "Course Builder", icon: Wrench },
  { to: "/admin/submissions", label: "Grading", icon: ClipboardCheck },
  { to: "/admin/live", label: "Live Classes", icon: Video },
  { to: "/admin/announcements", label: "Announcements", icon: Bell },
  { to: "/admin/audit-logs", label: "Audit Logs", icon: ClipboardList },
] as const;

function AdminTabs() {
  const location = useLocation();
  return (
    <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-1 border-b border-border">
        {ADMIN_TABS.map((tab) => {
          const active =
            tab.to === "/admin"
              ? location.pathname === "/admin" || location.pathname === "/admin/"
              : location.pathname === tab.to || location.pathname.startsWith(tab.to + "/");
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AdminHeader({
  eyebrow = "Administration",
  title,
  description,
  actions,
  showTabs = true,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  showTabs?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {eyebrow}
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {showTabs && <AdminTabs />}
    </div>
  );
}
