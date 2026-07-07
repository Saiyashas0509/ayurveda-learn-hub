import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { listThreads, createThread } from "@/lib/discussions.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageSquare, Heart, Pin, Megaphone, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/discussions/$courseId")({
  component: Page,
  errorComponent: ({ error }) => <div role="alert" className="p-8 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Course not found.</div>,
});

function Page() {
  const { courseId } = Route.useParams();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [ann, setAnn] = useState(false);
  const router = useRouter();

  const listFn = useServerFn(listThreads);
  const { data: threads = [], refetch } = useQuery({
    queryKey: ["threads", courseId, q],
    queryFn: () => listFn({ data: { courseId, q: q || undefined } }),
  });

  const createFn = useServerFn(createThread);
  const create = useMutation({
    mutationFn: () => createFn({ data: { courseId, title, body, isAnnouncement: ann } }),
    onSuccess: () => {
      setOpen(false); setTitle(""); setBody(""); setAnn(false);
      refetch(); router.invalidate();
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Discussions</h1>
          <p className="text-sm text-muted-foreground">Ask questions, share resources, get faculty answers.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>New thread</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Start a discussion</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Textarea placeholder="Share your question…" value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={ann} onChange={(e) => setAnn(e.target.checked)} />
                Post as announcement (pinned)
              </label>
              <Button onClick={() => create.mutate()} disabled={!title.trim() || !body.trim() || create.isPending}>Post</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search discussions…" className="pl-9" />
      </div>

      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {threads.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No threads yet.</p>}
        {threads.map((t) => (
          <Link key={t.id} to="/discussions/thread/$threadId" params={{ threadId: t.id }} className="flex items-start gap-4 p-4 hover:bg-accent/40">
            <div className="mt-1 flex flex-col items-center gap-1 text-xs text-muted-foreground">
              {t.is_pinned && <Pin className="h-4 w-4 text-gold" />}
              {t.is_announcement && <Megaphone className="h-4 w-4 text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium">{t.title}</p>
              <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{t.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                by {t.author_name} · {new Date(t.last_activity_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {t.reply_count}</span>
              <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" /> {t.like_count}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
