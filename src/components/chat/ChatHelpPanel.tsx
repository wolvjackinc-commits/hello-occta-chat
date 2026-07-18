import { useMemo, useState } from "react";
import { Search, ExternalLink, Sparkles, Headphones, TicketPlus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { faqs } from "@/data/faqs";
import { helpArticles } from "@/data/helpArticles";

type ChatMessage = { role: "user" | "assistant"; content: string };

type Result = {
  kind: "faq" | "article";
  title: string;
  snippet: string;
  href: string;
  score: number;
};

const STOP_WORDS = new Set([
  "the","a","an","is","are","of","to","and","or","for","in","on","with",
  "i","my","me","you","your","we","us","our","how","do","does","can","it",
  "that","this","have","has","was","were","be","been","but","so","if","at",
  "as","from","not","help","please","hi","hey","hello",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

function scoreAgainst(query: Set<string>, haystack: string): number {
  const tokens = tokenize(haystack);
  let hits = 0;
  for (const t of tokens) if (query.has(t)) hits += 1;
  return hits;
}

function buildResults(queryTokens: Set<string>, freeText: string): Result[] {
  const q = freeText.trim().toLowerCase();
  const results: Result[] = [];

  for (const f of faqs) {
    const hay = `${f.question} ${f.answer} ${f.category}`;
    let score = scoreAgainst(queryTokens, hay);
    if (q && `${f.question} ${f.answer}`.toLowerCase().includes(q)) score += 5;
    if (score > 0) {
      results.push({
        kind: "faq",
        title: f.question,
        snippet: f.answer.slice(0, 140),
        href: `/faq#${encodeURIComponent(f.question).slice(0, 60)}`,
        score,
      });
    }
  }

  for (const a of helpArticles) {
    const hay = `${a.title} ${a.description} ${a.keywords} ${a.category}`;
    let score = scoreAgainst(queryTokens, hay);
    if (q && hay.toLowerCase().includes(q)) score += 5;
    if (score > 0) {
      results.push({
        kind: "article",
        title: a.title,
        snippet: a.description.slice(0, 140),
        href: `/help/${a.slug}`,
        score: score + 1, // slight boost so long-form beats a single FAQ tie
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

interface Props {
  messages: ChatMessage[];
  onClose: () => void;
  onEscalate: () => void;
  onCreateTicket: () => void;
}

export default function ChatHelpPanel({ messages, onClose, onEscalate, onCreateTicket }: Props) {
  const [query, setQuery] = useState("");

  // "Top sources" = matches against everything the user has said in this chat.
  const conversationTokens = useMemo(() => {
    const userText = messages.filter((m) => m.role === "user").map((m) => m.content).join(" ");
    return new Set(tokenize(userText));
  }, [messages]);

  const topSources = useMemo(
    () => buildResults(conversationTokens, "").slice(0, 3),
    [conversationTokens]
  );

  const queryTokens = useMemo(() => new Set(tokenize(query)), [query]);
  const searchResults = useMemo(() => {
    if (!query.trim()) return [] as Result[];
    return buildResults(queryTokens, query).slice(0, 8);
  }, [query, queryTokens]);

  return (
    <div
      className="flex flex-col h-full min-h-0 bg-background"
      role="region"
      aria-label="Help Centre search"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b-2 border-foreground">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          <h3 className="font-display uppercase text-sm">Help Centre</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-muted transition-colors"
          aria-label="Close Help Centre and return to chat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 border-b-2 border-foreground/20">
        <label htmlFor="chat-help-search" className="sr-only">
          Search Help Centre articles and FAQs
        </label>
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="chat-help-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search FAQs and guides…"
            className="pl-9 border-2 border-foreground"
            autoFocus
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {query.trim() ? (
          <section aria-labelledby="chat-help-results">
            <h4 id="chat-help-results" className="text-[10px] font-display uppercase tracking-wider text-muted-foreground mb-2">
              {searchResults.length} result{searchResults.length === 1 ? "" : "s"}
            </h4>
            {searchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing matched "{query}". Try different words, or talk to a human below.
              </p>
            ) : (
              <ul className="space-y-2">
                {searchResults.map((r, i) => (
                  <ResultCard key={i} result={r} />
                ))}
              </ul>
            )}
          </section>
        ) : (
          <>
            {topSources.length > 0 && (
              <section aria-labelledby="chat-help-sources">
                <h4 id="chat-help-sources" className="text-[10px] font-display uppercase tracking-wider text-muted-foreground mb-2">
                  Top sources from your chat
                </h4>
                <ul className="space-y-2">
                  {topSources.map((r, i) => (
                    <ResultCard key={i} result={r} />
                  ))}
                </ul>
              </section>
            )}
            <section aria-labelledby="chat-help-tip">
              <h4 id="chat-help-tip" className="text-[10px] font-display uppercase tracking-wider text-muted-foreground mb-2">
                Or search
              </h4>
              <p className="text-sm text-muted-foreground">
                Type a keyword above (e.g. "invoice", "wifi", "port number") to find guides and FAQs.
              </p>
            </section>
          </>
        )}
      </div>

      <div
        className="p-4 border-t-2 border-foreground bg-muted/30 space-y-2"
        aria-label="Talk to a human"
      >
        <p className="text-xs text-muted-foreground">Not finding what you need?</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-2 border-foreground"
            onClick={onEscalate}
          >
            <Headphones className="w-4 h-4 mr-1.5" />
            Talk to a human
          </Button>
          <Button
            type="button"
            size="sm"
            className="border-2 border-foreground bg-foreground text-background hover:bg-foreground/90"
            onClick={onCreateTicket}
          >
            <TicketPlus className="w-4 h-4 mr-1.5" />
            Create a ticket
          </Button>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ result }: { result: Result }) {
  return (
    <li>
      <a
        href={result.href}
        target={result.kind === "article" ? "_blank" : undefined}
        rel={result.kind === "article" ? "noreferrer" : undefined}
        className="block border-2 border-foreground/40 hover:border-foreground p-3 bg-card transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold line-clamp-2">{result.title}</p>
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
        </div>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{result.snippet}</p>
        <span className="mt-1 inline-block text-[10px] font-display uppercase tracking-wider text-muted-foreground">
          {result.kind === "faq" ? "FAQ" : "Guide"}
        </span>
      </a>
    </li>
  );
}