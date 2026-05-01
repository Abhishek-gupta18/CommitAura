import { useState } from "react";
import { useLocation } from "wouter";
import { Search, Github, Copy, Check, Code2, ExternalLink, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      data-testid={`copy-${label}`}
      className="gap-2 font-mono text-xs h-8 shrink-0"
    >
      {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied!" : "Copy"}
    </Button>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [searchUsername, setSearchUsername] = useState("");
  const [badgeUsername, setBadgeUsername] = useState("");

  const baseUrl = window.location.origin;

  const cardUrl = badgeUsername.trim()
    ? `${baseUrl}/api/github/card?user=${encodeURIComponent(badgeUsername.trim())}`
    : null;

  const markdownSnippet = cardUrl
    ? `[![GitHub Stats](${cardUrl})](https://github.com/${badgeUsername.trim()})`
    : "";

  const htmlSnippet = cardUrl
    ? `<p><img align="center" src="${cardUrl}" alt="${badgeUsername.trim()}" /></p>`
    : "";

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchUsername.trim()) {
      setLocation(`/stats/${searchUsername.trim()}`);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <div className="flex flex-col items-center justify-center px-6 pt-24 pb-16 text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="h-16 w-16 rounded-2xl bg-card border flex items-center justify-center shadow-2xl shadow-primary/10 mb-6">
          <Github className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-5xl font-bold tracking-tight mb-3">GitHub Stats</h1>
        <p className="text-muted-foreground font-mono text-sm max-w-sm">
          Accurate contribution counts, streaks &amp; heatmaps.<br />
          Embed in your README in 30 seconds.
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-6 space-y-12 pb-24">

        {/* ── Section 1: Badge Generator ── */}
        <section className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 fill-mode-backwards">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-lg">Get your README badge</h2>
          </div>

          <div className="bg-card border rounded-xl p-5 space-y-5">
            {/* Username input */}
            <div className="flex gap-3">
              <div className="relative flex-1 flex items-center bg-background border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary/50 transition-all">
                <span className="pl-3 text-muted-foreground font-mono text-sm">github.com/</span>
                <Input
                  value={badgeUsername}
                  onChange={(e) => setBadgeUsername(e.target.value)}
                  placeholder="your-username"
                  data-testid="input-badge-username"
                  className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 font-mono text-sm pl-1 h-10"
                />
              </div>
            </div>

            {badgeUsername.trim() ? (
              <>
                {/* Live preview */}
                <div className="rounded-lg bg-[#0d1117] border p-4 flex items-center justify-center min-h-[80px]">
                  <img
                    src={cardUrl!}
                    alt={`GitHub stats for ${badgeUsername}`}
                    className="max-w-full"
                    data-testid="img-badge-preview"
                  />
                </div>

                {/* Markdown */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Markdown</span>
                    <CopyButton text={markdownSnippet} label="markdown" />
                  </div>
                  <pre className="bg-background border rounded-lg p-3 text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all">
                    {markdownSnippet}
                  </pre>
                </div>

                {/* HTML */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">HTML</span>
                    <CopyButton text={htmlSnippet} label="html" />
                  </div>
                  <pre className="bg-background border rounded-lg p-3 text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all">
                    {htmlSnippet}
                  </pre>
                </div>
              </>
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm font-mono">
                Type your GitHub username above to generate your badge
              </div>
            )}
          </div>
        </section>

        {/* ── Section 2: How it works ── */}
        <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-backwards">
          <h2 className="font-semibold text-lg">How it works</h2>
          <div className="grid gap-3">
            {[
              {
                step: "1",
                title: "Type your GitHub username above",
                desc: "Your badge URL is generated instantly — no account, no login required.",
              },
              {
                step: "2",
                title: "Copy the Markdown or HTML snippet",
                desc: "Open your GitHub profile README and paste it wherever you want the badge.",
              },
              {
                step: "3",
                title: "Done — stats update automatically",
                desc: "The badge refreshes every hour showing your real contributions and streak.",
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-4 bg-card border rounded-xl p-4">
                <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary font-mono">{step}</span>
                </div>
                <div>
                  <p className="font-medium text-sm">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Divider ── */}
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs font-mono">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* ── Section 3: View full stats ── */}
        <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-backwards">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-lg">View full stats dashboard</h2>
          </div>

          <form onSubmit={handleSearch} className="relative group">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
            <div className="relative flex items-center bg-card border rounded-xl shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-primary/50 transition-all">
              <div className="pl-4 pr-2 text-muted-foreground">
                <Github className="w-5 h-5" />
              </div>
              <Input
                value={searchUsername}
                onChange={(e) => setSearchUsername(e.target.value)}
                placeholder="Enter any GitHub username..."
                data-testid="input-search-username"
                className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-2 h-14 text-base font-mono placeholder:text-muted-foreground/50"
              />
              <div className="pr-2">
                <Button
                  type="submit"
                  disabled={!searchUsername.trim()}
                  size="lg"
                  className="rounded-lg font-mono gap-2"
                  data-testid="button-analyze"
                >
                  View <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </form>

          <p className="text-xs text-muted-foreground text-center font-mono">
            See the heatmap, all-time contributions, streaks and more for any public profile.
          </p>
        </section>

        {/* ── Footer ── */}
        <div className="text-center pt-4">
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
            data-testid="link-github"
          >
            <ExternalLink className="w-3 h-3" />
            Powered by GitHub API
          </a>
        </div>

      </div>
    </div>
  );
}
