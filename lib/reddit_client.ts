// reddit_client.ts
import { config } from "../config.ts";
import { ensureDir } from "std/fs";
// Ensure ProcessedRedditPost has a reliable `id` field.
// The existing `id: data.permalink.split('/')[4] || Date.now().toString()` should work,
// but using data.id (which is Reddit's internal base36 ID like `1abcde`) would be more standard if available directly,
// or `data.name` (which is `t3_1abcde`). `data.permalink` is also good.
// Let's refine the ID to be more robust if `data.name` is available.

interface RedditPostData {
  kind: string;
  data: {
    name: string; // This is the t3_xxxxx ID
    title: string;
    thumbnail?: string;
    link_flair_text?: string;
    permalink: string;
    url: string;
    domain: string;
    selftext: string;
    created_utc: number;
    stickied?: boolean; // Added for filtering
  };
}

interface ProcessedRedditPost {
  id: string; // Will use Reddit's `name` (e.g., t3_xxxxxx)
  title: string;
  flair: string | null;
  redditLink: string;
  sourceUrl: string;
  thumbnailUrl?: string;
  domain: string;
  textContent?: string;
  artist?: string;
  trackOrAlbumTitle?: string;
  featureType?: 'track' | 'album' | 'ep' | 'mv' | 'news' | 'rumor' | 'other';
  releaseDate?: string;
  producers?: string[];
  albumCoverUrl?: string;
  description?: string;
  spotifyLink?: string;
  appleMusicLink?: string;
}

async function fetchAndCacheRedditData(subredditUrl: string, limit: number): Promise<any> {
  const cachePath = config.reddit.cachePath;
  const cacheDuration = config.reddit.cacheDurationMs;

  try {
    const fileInfo = await Deno.stat(cachePath);
    const lastModified = fileInfo.mtime?.getTime() || 0;
    if (Date.now() - lastModified < cacheDuration) {
      console.log(`Using cached Reddit data from ${cachePath}`);
      const cachedData = await Deno.readTextFile(cachePath);
      return JSON.parse(cachedData);
    }
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      console.warn(`Error checking cache file ${cachePath}:`, error);
    }
    // If cache doesn't exist or other error, proceed to fetch
  }

  console.log(`Fetching fresh Reddit data from ${subredditUrl}`);
  const response = await fetch(`${subredditUrl}?limit=${limit}&t=day`);
  if (!response.ok) {
    throw new Error(`Failed to fetch Reddit data: ${response.status} ${response.statusText}`);
  }
  const jsonData = await response.json();

  try {
    await ensureDir("./tmp"); // Ensure tmp directory exists
    await Deno.writeTextFile(cachePath, JSON.stringify(jsonData, null, 2));
    console.log(`Cached Reddit data to ${cachePath}`);
  } catch (error) {
    console.error(`Error writing cache file ${cachePath}:`, error);
  }

  return jsonData;
}

export async function fetchRedditPosts(subredditUrl: string, limit: number = 25): Promise<ProcessedRedditPost[]> {
  try {
    const jsonData = await fetchAndCacheRedditData(subredditUrl, limit);
    if (!jsonData.data || !jsonData.data.children) {
        console.warn("Reddit API response format unexpected or no posts found:", jsonData);
        return [];
    }
    const posts: RedditPostData[] = jsonData.data.children;

    return posts
        .filter(post => !post.data.stickied) // Filter out stickied posts
        .map(post => processRedditPost(post.data))
        .filter(p => p !== null) as ProcessedRedditPost[];
  } catch (error) {
    console.error("Error fetching or processing Reddit posts:", error);
    return [];
  }
}

function processRedditPost(data: RedditPostData["data"]): ProcessedRedditPost | null {
  let thumbnailUrl = data.thumbnail;
  if (!thumbnailUrl || ['self', 'default', 'nsfw', ''].includes(thumbnailUrl)) {
      thumbnailUrl = undefined;
  }

  const processed: ProcessedRedditPost = {
    id: data.name, // Using Reddit's full t3_xxxxx ID for uniqueness
    title: data.title,
    flair: data.link_flair_text || null,
    redditLink: `https://www.reddit.com${data.permalink}`,
    sourceUrl: data.url,
    thumbnailUrl: thumbnailUrl,
    domain: data.domain,
    textContent: data.selftext || undefined,
    featureType: determineFeatureType(data.link_flair_text, data.title),
  };

  const titleParts = extractArtistAndTitle(data.title, processed.featureType);
  processed.artist = titleParts.artist;
  processed.trackOrAlbumTitle = titleParts.trackOrAlbumTitle;

  return processed;
}

function determineFeatureType(flair?: string, title?: string): ProcessedRedditPost['featureType'] {
    // ... (same as before)
    const lowerFlair = flair?.toLowerCase() || '';
    const lowerTitle = title?.toLowerCase() || '';

    if (lowerFlair.includes('music video') || lowerTitle.includes('[mv]')) return 'mv';
    if (lowerFlair.includes('album') || lowerFlair.includes('[album]')) return 'album';
    if (lowerFlair.includes('ep') || lowerFlair.includes('[ep]')) return 'ep';
    if (lowerFlair.includes('audio') || lowerTitle.includes('[audio]')) return 'track';
    if (lowerFlair.includes('news')) return 'news';
    if (lowerFlair.includes('rumor')) return 'rumor';
    return 'other';
}

function extractArtistAndTitle(title: string, featureType?: ProcessedRedditPost['featureType']): { artist?: string; trackOrAlbumTitle?: string } {
    // ... (same as before)
      let artist, trackOrAlbumTitle;
      const patterns = [
          /^(.*?)\s*-\s*(.*?)(?:\s*\[(.*?)\])?(?:\s*\(feat\.(.*?)\))?$/,
      ];

      for (const pattern of patterns) {
          const match = title.match(pattern);
          if (match) {
              artist = match[1]?.trim();
              trackOrAlbumTitle = match[2]?.trim();
              const tag = match[3]?.trim().toLowerCase();
              const featuredArtist = match[4]?.trim();

              if (featuredArtist && featureType === 'track') {
                  trackOrAlbumTitle += ` (feat. ${featuredArtist})`;
              }
              if (tag) {
                  if (tag.includes('mv') && !featureType) featureType = 'mv';
                  if (tag.includes('album') && !featureType) featureType = 'album';
              }
              break;
          }
      }
      if (!artist && title.includes('-')) {
          const parts = title.split('-').map(p => p.trim());
          artist = parts[0];
          trackOrAlbumTitle = parts.slice(1).join(' - ').replace(/\[.*?\]/g, '').trim();
      }

      if (trackOrAlbumTitle) {
          trackOrAlbumTitle = trackOrAlbumTitle.replace(/(\[MV\]|\[Audio\]|\[Album\]|\[EP\]|\(.*?Prod.*?\))/gi, '').trim();
      }
      return { artist, trackOrAlbumTitle };
}

export type { ProcessedRedditPost };