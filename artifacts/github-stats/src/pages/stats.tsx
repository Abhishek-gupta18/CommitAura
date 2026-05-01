import { useRoute } from "wouter";
import { 
  useGetGithubProfile, 
  useGetGithubStats, 
  useGetGithubContributions 
} from "@workspace/api-client-react";
import { useGithubToken } from "@/hooks/use-github-token";
import { Link } from "wouter";
import { 
  Github, 
  ArrowLeft, 
  Flame, 
  Trophy, 
  Calendar, 
  Star,
  Users,
  BookOpen,
  MapPin,
  Link as LinkIcon,
  Twitter,
  Building,
  Settings2
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format, parseISO } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ContributionCalendar({ username, token }: { username: string, token: string }) {
  const { data: calendar, isLoading, error } = useGetGithubContributions(username, { token });

  if (isLoading) {
    return <Skeleton className="w-full h-48 rounded-xl" />;
  }

  if (error || !calendar) {
    return <div className="w-full h-48 rounded-xl bg-card border flex items-center justify-center text-muted-foreground text-sm font-mono">Failed to load calendar</div>;
  }

  const levels = {
    0: "bg-card/50 border border-border/50",
    1: "bg-primary/20 border border-primary/30",
    2: "bg-primary/40 border border-primary/50",
    3: "bg-primary/70 border border-primary/80",
    4: "bg-primary border border-primary",
  };

  return (
    <div className="bg-card border rounded-xl p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-medium flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          Contributions {calendar.year}
        </h3>
        <span className="text-sm font-mono text-muted-foreground">
          <span className="text-primary font-bold">{calendar.totalContributions.toLocaleString()}</span> total
        </span>
      </div>
      
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-1 min-w-max">
          {calendar.weeks.map((week, i) => (
            <div key={i} className="flex flex-col gap-1">
              {week.days.map((day, j) => (
                <Tooltip key={`${i}-${j}`}>
                  <TooltipTrigger asChild>
                    <div 
                      className={`w-3.5 h-3.5 rounded-sm ${levels[day.level as keyof typeof levels] || levels[0]} transition-all duration-200 hover:ring-2 hover:ring-primary hover:scale-110`}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="font-mono text-xs">
                    <span className="text-primary font-bold">{day.count}</span> contributions on {day.date}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  subtitle, 
  delayClass 
}: { 
  title: string; 
  value: string | number; 
  icon: any; 
  subtitle?: string | null;
  delayClass: string;
}) {
  return (
    <div className={`bg-card border rounded-xl p-5 flex flex-col justify-between animate-in fade-in slide-in-from-bottom-4 duration-700 ${delayClass} fill-mode-backwards`}>
      <div className="flex items-center justify-between text-muted-foreground mb-4">
        <span className="text-sm font-medium">{title}</span>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="text-3xl font-bold tracking-tight font-mono">{value}</div>
        {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
      </div>
    </div>
  );
}

export default function Stats() {
  const [match, params] = useRoute("/stats/:username");
  const username = params?.username || "";
  const { token, setToken } = useGithubToken();

  const { 
    data: profile, 
    isLoading: profileLoading,
    error: profileError
  } = useGetGithubProfile(username, { token }, { query: { retry: false } });

  const { 
    data: stats, 
    isLoading: statsLoading 
  } = useGetGithubStats(username, { token }, { query: { retry: false } });

  if (profileError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md animate-in fade-in duration-500">
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 text-destructive mx-auto flex items-center justify-center mb-6">
            <Trophy className="w-8 h-8 opacity-50" />
          </div>
          <h2 className="text-2xl font-bold">User Not Found</h2>
          <p className="text-muted-foreground">We couldn't find a GitHub user named <span className="font-mono text-foreground">{username}</span>.</p>
          <div className="pt-6">
            <Link href="/" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
              <Search className="w-4 h-4 mr-2" />
              Search Again
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isLoading = profileLoading || statsLoading;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back to search</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground">
                  <Settings2 className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">API Configuration</h4>
                    <p className="text-xs text-muted-foreground">
                      Add a GitHub Personal Access Token to increase your API rate limit.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pat">Personal Access Token</Label>
                    <Input
                      id="pat"
                      type="password"
                      placeholder="ghp_..."
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 pt-10 space-y-10">
        {/* Profile Section */}
        {isLoading ? (
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <Skeleton className="w-32 h-32 rounded-2xl" />
            <div className="space-y-4 flex-1">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-full max-w-md" />
              <div className="flex gap-4 pt-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </div>
        ) : profile ? (
          <div className="flex flex-col md:flex-row gap-8 items-start animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="relative group">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <img 
                src={profile.avatarUrl} 
                alt={profile.username} 
                className="relative w-32 h-32 rounded-2xl border bg-card object-cover shadow-xl"
              />
            </div>
            
            <div className="flex-1 space-y-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                  {profile.name || profile.username}
                  <a href={`https://github.com/${profile.username}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                    <Github className="w-6 h-6" />
                  </a>
                </h1>
                <p className="text-muted-foreground font-mono mt-1">@{profile.username}</p>
              </div>

              {profile.bio && (
                <p className="text-lg max-w-2xl leading-relaxed">{profile.bio}</p>
              )}

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground font-mono">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-primary/70" />
                  <span className="text-foreground">{profile.followers}</span> followers
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 opacity-50" />
                  <span className="text-foreground">{profile.following}</span> following
                </div>
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-primary/70" />
                  <span className="text-foreground">{profile.publicRepos}</span> repos
                </div>
              </div>

              <div className="flex flex-wrap gap-y-2 gap-x-6 text-sm pt-2">
                {profile.company && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building className="w-4 h-4" />
                    <span>{profile.company}</span>
                  </div>
                )}
                {profile.location && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span>{profile.location}</span>
                  </div>
                )}
                {profile.blog && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <LinkIcon className="w-4 h-4" />
                    <a href={profile.blog.startsWith('http') ? profile.blog : `https://${profile.blog}`} target="_blank" rel="noreferrer" className="hover:text-primary hover:underline">
                      {profile.blog.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}
                {profile.twitterUsername && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Twitter className="w-4 h-4" />
                    <a href={`https://twitter.com/${profile.twitterUsername}`} target="_blank" rel="noreferrer" className="hover:text-primary hover:underline">
                      @{profile.twitterUsername}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Stats Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
              title="Total Contributions" 
              value={stats.totalContributions.toLocaleString()} 
              icon={Star} 
              delayClass="delay-100"
            />
            <StatCard 
              title="Contributions This Year" 
              value={stats.contributionsThisYear.toLocaleString()} 
              icon={Calendar} 
              delayClass="delay-200"
            />
            <StatCard 
              title="Current Streak" 
              value={stats.currentStreak} 
              subtitle={stats.currentStreakStart && stats.currentStreakEnd ? `${format(parseISO(stats.currentStreakStart), 'MMM d')} - ${format(parseISO(stats.currentStreakEnd), 'MMM d')}` : null}
              icon={Flame} 
              delayClass="delay-300"
            />
            <StatCard 
              title="Longest Streak" 
              value={stats.longestStreak} 
              subtitle={stats.longestStreakStart && stats.longestStreakEnd ? `${format(parseISO(stats.longestStreakStart), 'MMM d')} - ${format(parseISO(stats.longestStreakEnd), 'MMM d')}` : null}
              icon={Trophy} 
              delayClass="delay-400"
            />
          </div>
        ) : null}

        {/* Heatmap */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500 fill-mode-backwards">
          <ContributionCalendar username={username} token={token} />
        </div>

      </main>
    </div>
  );
}
