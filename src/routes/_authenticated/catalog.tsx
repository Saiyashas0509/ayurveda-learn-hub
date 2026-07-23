import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listCatalog } from "@/lib/learning.functions";
import { useState } from "react";
import { BookOpen, Search, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/catalog")({
  component: Catalog,
});

function Catalog() {
  const fn = useServerFn(listCatalog);
  const { data } = useSuspenseQuery(
    queryOptions({ queryKey: ["catalog"], queryFn: () => fn() }),
  );
  const [q, setQ] = useState("");

  const filtered = data.courses.filter(
    (c) => q === "" || c.title.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Learning</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Course Catalog</h1>
        <p className="mt-1 text-sm text-muted-foreground">Search for a course.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search courses…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No courses yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Link
              key={c.id}
              to="/courses/$slug"
              params={{ slug: c.slug }}
              className="group flex flex-col rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated"
            >
              <div className="mb-3 h-32 rounded-lg bg-hero" />
              <h3 className="font-display text-lg font-semibold group-hover:text-primary">{c.title}</h3>
              <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">{c.description}</p>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> {c.duration_minutes ?? 0} min
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
