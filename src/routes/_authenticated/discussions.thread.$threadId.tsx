import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { getThread, createReply, toggleLike, pinThread, deleteThread } from "@/lib/discussions.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Heart, Pin, ShieldCheck, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/discussions/thread/$threadId")({
  component: Page,
  errorComponent: ({ error }) => <div role="alert" className="p-8 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Thread not found.</div>,
});

function Page() {
  const { threadId } = Route.useParams();
  const getFn = useServerFn(getThread);
  const { data, refetch } = useQuery({
    queryKey: ["thread", threadId],
    queryFn: () => getFn({ data: { id: threadId } }),
  });

  const replyFn = useServerFn(createReply);
  const likeFn = useServerFn(toggleLike);
  const pinFn = useServerFn(pinThread);
  const delFn = useServerFn(deleteThread);

  const [body, setBody] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const reply = useMutation({
    mutationFn: () => replyFn({ data: { threadId, body, parentReplyId: parentId } }),
    onSuccess: () => { setBody(""); setParentId(null); refetch(); },
  });
  const like = useMutation({
    mutationFn: (v: { targetType: "thread" | "reply"; targetId: string }) => likeFn({ data: v }),
    onSuccess: () => refetch(),
  });

  if (!data) return <div className="p-8">Loading…</div>;
  const { thread, replies } = data;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold">{thread.title}</h1>
            <p className="mt-1 text-xs text-muted-foreground">by {thread.author_name} · {new Date(thread.created_at).toLocaleString()}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => pinFn({ data: { id: thread.id, pinned: !thread.is_pinned } }).then(() => refetch())}>
              <Pin className="h-4 w-4" /> {thread.is_pinned ? "Unpin" : "Pin"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { if (confirm("Delete thread?")) delFn({ data: { id: thread.id } }).then(() => history.back()); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm">{thread.body}</p>
        <div className="mt-4">
          <Button size="sm" variant={thread.liked ? "default" : "outline"} onClick={() => like.mutate({ targetType: "thread", targetId: thread.id })}>
            <Heart className={`h-4 w-4 ${thread.liked ? "fill-current" : ""}`} /> {thread.like_count}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {replies.length === 0 && <p className="text-sm text-muted-foreground">Be the first to reply.</p>}
        {replies.map((r) => {
          const indent = r.parent_reply_id ? "ml-8" : "";
          return (
            <div key={r.id} className={`${indent} rounded-lg border border-border bg-card p-4`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{r.author_name}</span>
                  {r.is_faculty_answer && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      <ShieldCheck className="h-3 w-3" /> Faculty
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <div className="flex gap-2">
                  <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setParentId(r.id)}>Reply</button>
                  <button className="inline-flex items-center gap-1 text-xs" onClick={() => like.mutate({ targetType: "reply", targetId: r.id })}>
                    <Heart className={`h-3 w-3 ${r.liked ? "fill-current text-primary" : ""}`} /> {r.like_count}
                  </button>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{r.body}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        {parentId && (
          <p className="mb-2 text-xs text-muted-foreground">
            Replying to a comment · <button className="underline" onClick={() => setParentId(null)}>cancel</button>
          </p>
        )}
        <Textarea placeholder="Write a reply…" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="mt-2 flex justify-end">
          <Button onClick={() => reply.mutate()} disabled={!body.trim() || reply.isPending}>Post reply</Button>
        </div>
      </div>
    </div>
  );
}
