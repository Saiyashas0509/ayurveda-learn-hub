import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getDemoCatalog } from "@/lib/demo.functions";
import { useState } from "react";
import { Search, BookOpen, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/demo/catalog")({
  component: DemoCatalog,
  errorComponent: ({ error }) => <p className="text-sm text-destructive">{error.message}</p>,
});

function DemoCatalog() {
  const fn = useServerFn(getDemoCatalog);
  const { data } = useSuspenseQuery(queryOptions({ queryKey: ["demo-catalog"], queryFn: () => fn() }));
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const filtered = data.courses.filter(
    (c) => (!activeCat || c.category_id === activeCat) && (q === "" || c.title.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Learning</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Course Catalog</h1>
        <p className="mt-1 text-sm text-muted-foreground">Explore Ayurvedic training modules organized by function.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search courses…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCat(null)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${activeCat === null ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-foreground"}`}
        >
          All ({data.courses.length})
        </button>
        {data.categories.map((cat) => {
          const count = data.courses.filter((c) => c.category_id === cat.id).length;
          const active = activeCat === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCat(cat.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-foreground"}`}
            >
              {cat.name} {count > 0 && <span className="opacity-60">· {count}</span>}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => (
          <Link
            key={c.id}
            to="/demo/courses/$slug"
            params={{ slug: c.slug }}
            className="group rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated"
          >
            <h3 className="font-display text-lg font-semibold group-hover:text-primary">{c.title}</h3>
            {c.description && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{c.description}</p>}
            <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> Module</span>
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {c.duration_minutes ?? 0} min</span>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No courses match your filters.
          </p>
        )}
      </div>
    </div>
  );
}