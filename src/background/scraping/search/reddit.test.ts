import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../http", () => ({ fetchJson: vi.fn(), fetchText: vi.fn() }));

import { fetchText } from "../http";
import { searchReddit } from "./reddit";

const mockedFetchText = vi.mocked(fetchText);

afterEach(() => vi.clearAllMocks());

const SEARCH_HTML = `
<div class="search-result-link">
  <header>
    <a class="search-title" href="https://old.reddit.com/r/headphones/comments/abc/sony_wh1000xm5_review/">
      Sony WH-1000XM5 long-term review
    </a>
  </header>
  <a class="search-subreddit-link">r/headphones</a>
  <span class="search-score">128 points</span>
  <a class="search-comments">45 comments</a>
  <time datetime="2026-01-01T00:00:00+00:00"></time>
  <div class="search-result-body"><p>Great noise cancelling.</p></div>
</div>`;

describe("searchReddit (cheerio parse of old.reddit HTML)", () => {
  it("parses results and rewrites the URL to modern reddit", async () => {
    mockedFetchText.mockResolvedValueOnce(SEARCH_HTML);

    const results = await searchReddit("Sony WH-1000XM5");
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ subreddit: "r/headphones", score: 128, commentsCount: 45 });
    expect(results[0].url).toBe("https://www.reddit.com/r/headphones/comments/abc/sony_wh1000xm5_review/");
    expect(results[0].snippets).toEqual(["Great noise cancelling."]);
  });

  it("returns [] when the request fails", async () => {
    mockedFetchText.mockRejectedValueOnce(new Error("timeout"));
    expect(await searchReddit("x")).toEqual([]);
  });
});
