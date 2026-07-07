import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  Award,
  User,
  Shield,
  Bell,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, signOutFully, type AppRole } from "@/lib/auth-helpers";
import { BrandLogo } from "@/components/brand-logo";
import { ROLE_VIEWS, pickPrimaryRole } from "@/config/roleViews";

const IDLE_MS = 30 * 60 * 1000; // 30 min auto logout

function useIdleLogout() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        signOutFully();
      }, IDLE_MS);
    };
    const events: (keyof WindowEventMap)[] = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, []);
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useIdleLogout();

  const { data: me } = useQuery({
    queryKey: ["me-basic"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data: emp } = await supabase
        .from("employees")
        .select("full_name,email,designation,primary_role,centers(name),organizations(name,org_type)")
        .eq("id", u.user.id)
        .maybeSingle();
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      return { employee: emp, roles: (roles ?? []).map((r) => r.role as AppRole) };
    },
  });

  const roles = me?.roles ?? [];
  const primaryRole = (me?.employee?.primary_role as AppRole | null) ?? (roles.length ? pickPrimaryRole(roles) : "student");
  const view = ROLE_VIEWS[primaryRole];
  const initials = (me?.employee?.full_name ?? "T A")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const roleLabel = ROLE_LABELS[primaryRole];
  const orgName = (me?.employee as { organizations?: { name?: string } } | null | undefined)?.organizations?.name;

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
          <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 border-b border-sidebar-border/60 px-6 py-4">
            <BrandLogo onDark className="h-16" />
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {view.nav.map((group, idx) => (
              <div key={group.label} className={idx > 0 ? "mt-6" : ""}>
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">{group.label}</p>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <SideLink key={item.to} to={item.to} active={location.pathname === item.to || location.pathname.startsWith(item.to + "/")} onClick={() => setOpen(false)}>
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </SideLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-sidebar-border/60 px-4 py-4">
            <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent px-3 py-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold text-sm font-semibold text-gold-foreground">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{me?.employee?.full_name ?? "Employee"}</p>
                <p className="truncate text-xs text-sidebar-foreground/70">{roleLabel}</p>
              </div>
              <button
                onClick={() => signOutFully()}
                aria-label="Sign out"
                className="rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent-foreground/10 hover:text-sidebar-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Main */}
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">
              {orgName ? `${orgName} · ${roleLabel}` : roleLabel}
            </p>
          </div>
          <Link
            to="/catalog"
            className="hidden rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent md:inline-flex"
          >
            Browse Catalog
          </Link>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-10">{children}</main>
      </div>
    </div>
  );
}

function SideLink({
  to,
  active,
  children,
  onClick,
}: {
  to: string;
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      {children}
    </Link>
  );
}

// unused but kept for potential imports elsewhere
export const _reserved = useNavigate;
