import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getLiveClass, listMessages, postMessage, joinClass, createPoll, votePoll, closePoll, getPollResults, listRaisedHands } from "@/lib/live-classes.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Hand, Video, Send, BarChart3, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/live/$id")({
  component: Page,
  errorComponent: ({ error }) => <div role="alert" className="p-8 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Class not found.</div>,
});

function Page() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getLiveClass);
  const msgFn = useServerFn(listMessages);
  const handsFn = useServerFn(listRaisedHands);
  const joinFn = useServerFn(joinClass);
  const sendFn = useServerFn(postMessage);
  const pollNewFn = useServerFn(createPoll);

  const { data: cls } = useQuery({ queryKey: ["live", id], queryFn: () => getFn({ data: { id } }) });
  const { data: messages = [], refetch: refetchMsgs } = useQuery({ queryKey: ["live-msgs", id], queryFn: () => msgFn({ data: { classId: id } }) });
  const { data: hands = [], refetch: refetchHands } = useQuery({ queryKey: ["live-hands", id], queryFn: () => handsFn({ data: { classId: id } }) });

  useEffect(() => {
    const ch = supabase.channel(`live:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_class_messages", filter: `live_class_id=eq.${id}` }, () => { refetchMsgs(); refetchHands(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "live_class_polls", filter: `live_class_id=eq.${id}` }, () => { /* poll list refresh via getFn refetch elsewhere */ })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, refetchMsgs, refetchHands]);

  const [msg, setMsg] = useState("");
  const send = useMutation({
    mutationFn: () => sendFn({ data: { classId: id, body: msg } }),
    onSuccess: () => { setMsg(""); refetchMsgs(); },
  });
  const raise = useMutation({
    mutationFn: () => sendFn({ data: { classId: id, body: "🖐️", kind: "raise_hand" } }),
    onSuccess: () => refetchHands(),
  });

  const chatEnd = useRef<HTMLDivElement | null>(null);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  async function onJoin() {
    const r = await joinFn({ data: { id } });
    window.open(r.meetingUrl, "_blank", "noopener");
  }

  // Poll creation
  const [pollQ, setPollQ] = useState("");
  const [pollOpts, setPollOpts] = useState("Yes\nNo");
  const [showPoll, setShowPoll] = useState(false);
  async function submitPoll() {
    const options = pollOpts.split("\n").map((s) => s.trim()).filter(Boolean);
    if (!pollQ.trim() || options.length < 2) return;
    await pollNewFn({ data: { classId: id, question: pollQ, options } });
    setPollQ(""); setPollOpts("Yes\nNo"); setShowPoll(false);
  }

  if (!cls) return <div className="p-8">Loading…</div>;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div className="rounded-xl bg-hero p-6 text-primary-foreground">
          <p className="text-xs uppercase tracking-widest text-gold">{cls.cls.provider}</p>
          <h1 className="mt-1 font-display text-2xl font-semibold">{cls.cls.title}</h1>
          <p className="mt-1 text-sm text-primary-foreground/80">
            {(cls.cls.courses as { title?: string } | null)?.title} · {new Date(cls.cls.starts_at).toLocaleString()}
          </p>
          <div className="mt-4 flex gap-2">
            <Button onClick={onJoin} variant="secondary"><Video className="h-4 w-4" /> Join & log attendance</Button>
            <Button onClick={() => raise.mutate()} variant="outline"><Hand className="h-4 w-4" /> Raise hand</Button>
            <Button onClick={() => setShowPoll((v) => !v)} variant="outline"><BarChart3 className="h-4 w-4" /> Poll</Button>
          </div>
        </div>

        {showPoll && (
          <div className="rounded-xl border border-border bg-card p-4">
            <Input placeholder="Question" value={pollQ} onChange={(e) => setPollQ(e.target.value)} />
            <Textarea className="mt-2" placeholder="One option per line" value={pollOpts} onChange={(e) => setPollOpts(e.target.value)} rows={4} />
            <Button className="mt-2" onClick={submitPoll}>Publish poll</Button>
          </div>
        )}

        <div className="space-y-3">
          {cls.polls.map((p) => <PollCard key={p.id} poll={p} classId={id} />)}
        </div>
      </div>

      <div className="flex h-[600px] flex-col rounded-xl border border-border bg-card">
        <div className="border-b border-border p-3">
          <p className="text-sm font-medium">In-session chat</p>
          {hands.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground"><Hand className="inline h-3 w-3" /> {hands.slice(0, 5).map((h) => h.name).join(", ")} raised hand</p>
          )}
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
          {messages.filter((m) => m.kind === "chat").map((m) => (
            <div key={m.id}>
              <span className="font-medium">{m.author_name}:</span> <span>{m.body}</span>
            </div>
          ))}
          <div ref={chatEnd} />
        </div>
        <form className="flex gap-2 border-t border-border p-3" onSubmit={(e) => { e.preventDefault(); if (msg.trim()) send.mutate(); }}>
          <Input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Message" />
          <Button type="submit" size="icon"><Send className="h-4 w-4" /></Button>
        </form>
      </div>
    </div>
  );
}

function PollCard({ poll, classId }: { poll: { id: string; question: string; options: unknown; closed_at: string | null }; classId: string }) {
  const resFn = useServerFn(getPollResults);
  const voteFn = useServerFn(votePoll);
  const closeFn = useServerFn(closePoll);
  const options = (Array.isArray(poll.options) ? poll.options : []) as string[];
  const { data, refetch } = useQuery({
    queryKey: ["poll", poll.id],
    queryFn: () => resFn({ data: { pollId: poll.id } }),
    refetchInterval: 5000,
  });
  useEffect(() => {
    const ch = supabase.channel(`poll:${poll.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_class_poll_votes", filter: `poll_id=eq.${poll.id}` }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [poll.id, refetch]);
  void classId;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="font-medium">{poll.question}</p>
        {!poll.closed_at && <Button size="sm" variant="ghost" onClick={() => closeFn({ data: { pollId: poll.id } }).then(() => refetch())}><X className="h-4 w-4" /> Close</Button>}
      </div>
      <div className="mt-3 space-y-2">
        {options.map((opt, i) => {
          const count = data?.counts?.[i] ?? 0;
          const total = data?.total ?? 0;
          const pct = total ? Math.round((count / total) * 100) : 0;
          const isMine = data?.myVote === i;
          return (
            <button key={i} className="block w-full text-left" onClick={() => !poll.closed_at && voteFn({ data: { pollId: poll.id, optionIndex: i } }).then(() => refetch())}>
              <div className={`relative overflow-hidden rounded-md border ${isMine ? "border-primary" : "border-border"} p-2`}>
                <div className="absolute inset-y-0 left-0 bg-primary/10" style={{ width: `${pct}%` }} />
                <div className="relative flex justify-between text-sm"><span>{opt}</span><span>{pct}% · {count}</span></div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
