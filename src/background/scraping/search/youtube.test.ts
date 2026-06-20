import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../http", () => ({ fetchJson: vi.fn(), fetchText: vi.fn() }));

import { fetchText } from "../http";
import { searchYoutube } from "./youtube";

const mockedFetchText = vi.mocked(fetchText);

afterEach(() => vi.clearAllMocks());

function ytHtml(): string {
  const data = {
    contents: {
      twoColumnSearchResultsRenderer: {
        primaryContents: {
          sectionListRenderer: {
            contents: [
              {
                itemSectionRenderer: {
                  contents: [
                    {
                      videoRenderer: {
                        videoId: "abc123",
                        title: { runs: [{ text: "Sony WH-1000XM5 Review" }] },
                        ownerText: { runs: [{ text: "TechChannel" }] },
                        viewCountText: { simpleText: "1.2M views" },
                        publishedTimeText: { simpleText: "1 year ago" },
                        lengthText: { simpleText: "12:34" },
                        thumbnail: { thumbnails: [{ url: "https://img/t.jpg" }] }
                      }
                    }
                  ]
                }
              }
            ]
          }
        }
      }
    }
  };
  return `<script>var ytInitialData = ${JSON.stringify(data)};</script>`;
}

describe("searchYoutube", () => {
  it("extracts videos from ytInitialData and dedupes across the two queries", async () => {
    // searchYoutube runs "<title> review" and "<title> unboxing" — same blob for both.
    mockedFetchText.mockResolvedValue(ytHtml());

    const results = await searchYoutube("Sony WH-1000XM5");
    expect(results).toHaveLength(1); // deduped by videoId
    expect(results[0]).toMatchObject({
      videoId: "abc123",
      channel: "TechChannel",
      views: "1.2M views",
      duration: "12:34"
    });
    expect(results[0].url).toBe("https://www.youtube.com/watch?v=abc123");
  });

  it("returns [] when the data blob is absent", async () => {
    mockedFetchText.mockResolvedValue("<html>no data</html>");
    expect(await searchYoutube("x")).toEqual([]);
  });
});
