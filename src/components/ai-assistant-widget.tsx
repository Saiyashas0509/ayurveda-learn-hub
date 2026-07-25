import { useRef, useState, useEffect } from "react";
import { askAyurvedaAssistant } from "@/lib/ai-assistant.functions";
import { Button } from "@/components/ui/button";
import { Leaf, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStoredConsent } from "@/lib/cookie-consent";

type ChatMessage = { role: "user" | "assistant"; content: string };

// Floating chat widget available anywhere inside AppShell. Conversation
// history lives only in this component's state — nothing is persisted, so a
// page refresh starts a fresh conversation. Kept deliberately simple (no
// streaming, no markdown rendering) since the model is instructed to answer
// in a few plain sentences.
export function AiAssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  // The cookie consent banner (fixed to the same bottom edge) covers this
  // area until dismissed — sit higher until then so it's never hidden
  // behind it for first-time visitors.
  const [bannerShowing, setBannerShowing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBannerShowing(getStoredConsent() === null);
    const onChange = () => setBannerShowing(getStoredConsent() === null);
    window.addEventListener("cookie-consent-changed", onChange);
    return () => window.removeEventListener("cookie-consent-changed", onChange);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setSending(true);
    try {
      const res = await askAyurvedaAssistant({
        data: { message: text, history: nextMessages.slice(0, -1).slice(-12) },
      });
      if (res.error && !res.reply) {
        setNotConfigured(true);
        setMessages((m) => [...m, { role: "assistant", content: res.error! }]);
      } else if (res.reply) {
        setMessages((m) => [...m, { role: "assistant", content: res.reply! }]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "Something went wrong reaching the assistant. Please try again.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className={cn(
        "fixed right-5 z-[80] transition-[bottom] duration-200",
        bannerShowing ? "bottom-28 sm:bottom-24" : "bottom-5",
      )}
    >
      {open && (
        <div className="mb-3 flex h-[28rem] w-80 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-elevated sm:w-96">
          <div className="flex items-center justify-between border-b border-border bg-hero px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              <Leaf className="h-4 w-4 text-gold" />
              <p className="text-sm font-semibold">Ayurveda Assistant</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded p-1 hover:bg-primary-foreground/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Ask me anything about Ayurveda — principles, herbs, treatments, or practices taught
                here. I only answer Ayurveda-related questions.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                  Thinking…
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 border-t border-border p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={notConfigured ? "Assistant not set up yet" : "Ask about Ayurveda…"}
              disabled={notConfigured || sending}
              maxLength={2000}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            />
            <Button
              type="submit"
              size="icon"
              disabled={notConfigured || sending || !input.trim()}
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Ayurveda Assistant"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elevated transition-transform hover:scale-105"
      >
        <Leaf className="h-6 w-6" />
      </button>
    </div>
  );
}
