import { Eye, Globe, MessageCircle } from "lucide-react";
import type { ComparisonResult } from "../../../shared/types";
import { formatRelativeTime } from "../../lib/time";
import { Spinner } from "../../atoms/Spinner";
import { stripEmojis } from "../../lib/text";
import { formatViewCount, parseViewCount } from "../../lib/socialFormat";
import { SocialPlatformGroup, type SocialItem } from "./SocialPlatformGroup";
import { RedditIcon, RedditUpvoteIcon, YoutubeIcon } from "./icons";

type SocialTabProps = {
  comparisons: ComparisonResult;
  loading: boolean;
};

export function SocialTab({ comparisons, loading }: SocialTabProps) {
  const sortedReddit = [...comparisons.reddit].sort((a, b) => b.score - a.score);
  const sortedYoutube = [...comparisons.youtube].sort(
    (a, b) => parseViewCount(b.views) - parseViewCount(a.views)
  );

  const redditItems: SocialItem[] = sortedReddit.map((post) => ({
    title: post.title,
    url: post.url,
    snippet: post.snippets[0],
    topMeta: (
      <div className="flex items-center gap-1.5">
        <span className="rounded-full bg-shopiq-accent-soft px-1.5 py-px text-[10px] font-medium text-black">
          r/{post.subreddit.replace(/^r\//i, "")}
        </span>
        <span className="text-[10px] text-shopiq-muted">{formatRelativeTime(post.createdAt)}</span>
      </div>
    ),
    bottomMeta: (
      <div className="flex items-center gap-3 text-[11px] text-shopiq-muted">
        <span className="inline-flex items-center gap-1">
          <RedditUpvoteIcon className="h-3 w-3" /> {post.score.toLocaleString()}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageCircle className="h-3 w-3" /> {post.commentsCount.toLocaleString()} comments
        </span>
      </div>
    )
  }));

  const youtubeItems: SocialItem[] = sortedYoutube.map((post) => ({
    title: stripEmojis(post.title),
    url: post.url,
    thumbnailUrl: post.thumbnailUrl,
    duration: post.duration,
    bottomMeta: (
      <p className="flex items-center gap-1 text-[11px] text-shopiq-muted">
        <span className="min-w-0 truncate">{post.channel}</span>
        <span className="flex shrink-0 items-center gap-1 whitespace-nowrap">
          <span aria-hidden="true">·</span>
          <Eye className="h-3 w-3" />
          {formatViewCount(post.views)} · {post.publishedTime}
        </span>
      </p>
    )
  }));

  const platforms = [
    {
      name: "YouTube",
      subheading: "reviews",
      icon: <YoutubeIcon className="h-[18px] w-[18px]" />,
      items: youtubeItems
    },
    {
      name: "Reddit",
      subheading: "stories",
      icon: <RedditIcon className="h-[18px] w-[18px]" />,
      items: redditItems
    }
  ].filter((platform) => platform.items.length > 0);

  return (
    <div data-testid="shopiq-social-tab" className="flex flex-col gap-2.5 p-3.5">
      <div
        data-testid="shopiq-social-summary"
        className="flex items-center gap-2 rounded-xl border border-shopiq-border bg-shopiq-panel px-3 py-2 text-xs text-shopiq-body"
      >
        <Globe className="h-3.5 w-3.5 text-shopiq-brand" />
        Aggregated from {platforms.length} platforms
        {loading ? <Spinner className="ml-auto h-3.5 w-3.5 text-shopiq-brand" /> : null}
      </div>

      {platforms.map((platform) => (
        <SocialPlatformGroup
          key={platform.name}
          icon={platform.icon}
          name={platform.name}
          subheading={platform.subheading}
          items={platform.items}
          defaultOpen
        />
      ))}
    </div>
  );
}
