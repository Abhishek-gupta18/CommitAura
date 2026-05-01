import { useState } from "react";
import { useLocation } from "wouter";
import { Search, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Home() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      setLocation(`/stats/${username.trim()}`);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 selection:bg-primary/30">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="flex flex-col items-center mb-10 space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-card border flex items-center justify-center shadow-2xl shadow-primary/10">
            <Github className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">GitHub Stats</h1>
          <p className="text-muted-foreground font-mono text-sm text-center max-w-sm">
            A precise, data-forward identity card for your open source life.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="relative group">
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
          <div className="relative flex items-center bg-card border rounded-xl shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-primary/50 transition-all">
            <div className="pl-4 pr-2 text-muted-foreground">
              <Search className="w-5 h-5" />
            </div>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter GitHub username..."
              className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-2 h-14 text-lg font-mono placeholder:text-muted-foreground/50"
              autoFocus
            />
            <div className="pr-2">
              <Button type="submit" disabled={!username.trim()} size="lg" className="rounded-lg font-mono">
                Analyze
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
