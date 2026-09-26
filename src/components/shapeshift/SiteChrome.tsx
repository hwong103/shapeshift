import { Heart, Star } from "lucide-react";

const REPO = "anishfn/shapeshift";

// Star count refreshes hourly; a failed fetch just hides the number.
async function getStars(): Promise<number | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}`, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data: { stargazers_count?: number } = await res.json();
    return data.stargazers_count ?? null;
  } catch {
    return null;
  }
}

const BUTTON =
  "inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-[13px] font-medium text-muted-foreground shadow-xs transition-[color,background-color,scale] duration-150 ease-out hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.96]";

const formatStars = (n: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

function GithubMark(props: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden {...props}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export async function SiteChrome({ children }: { children?: React.ReactNode }) {
  const stars = await getStars();
  return (
    <>
      <div className="fixed end-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] z-30 flex flex-wrap items-center justify-end gap-2">
        {children}
        <a href="https://github.com/sponsors/anishfn" target="_blank" rel="noopener noreferrer" className={`group ${BUTTON}`}>
          <Heart
            aria-hidden
            className="size-4 transition-colors duration-150 ease-out group-hover:fill-pink-500 group-hover:text-pink-500"
          />
          Sponsor
        </a>
        <a
          href={`https://github.com/${REPO}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={stars === null ? "Shapeshift on GitHub" : `Shapeshift on GitHub, ${stars} stars`}
          className={BUTTON}
        >
          <GithubMark className="size-4" />
          GitHub
          {stars !== null && (
            <>
              <span aria-hidden className="bg-border h-3.5 w-px" />
              <Star aria-hidden className="size-3.5" />
              <span className="tabular-nums">{formatStars(stars)}</span>
            </>
          )}
        </a>
      </div>
      <a
        href="https://x.com/anishfn"
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground focus-visible:outline-ring fixed start-[max(1rem,env(safe-area-inset-left))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 font-mono text-[12px] leading-4 transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        made by <span className="decoration-border underline underline-offset-2">anishfn</span>
      </a>
    </>
  );
}
