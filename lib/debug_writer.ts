// debug_writer.ts
import type { ProcessedRedditPost } from "./reddit_client.ts";
import { config } from "../src/config.ts";
import { ensureDir } from "@std/fs";

function generateMarkdownContent(post: ProcessedRedditPost): string {
  let frontmatter = "---\n";
  frontmatter += `title: "${post.title.replace(/"/g, '\\\\"')}"\n`;
  frontmatter += `redditLink: ${post.redditLink}\n`;
  frontmatter += `sourceUrl: ${post.sourceUrl}\n`;
  if (post.flair) frontmatter += `flair: ${post.flair}\n`;
  if (post.domain) frontmatter += `domain: ${post.domain}\n`;
  if (post.thumbnailUrl) frontmatter += `thumbnailUrl: ${post.thumbnailUrl}\n`;
  if (post.artist) {
    frontmatter += `artist: "${post.artist.replace(/"/g, '\\\\"')}"\n`;
  }
  if (post.trackOrAlbumTitle) {
    frontmatter += `trackOrAlbumTitle: "${
      post.trackOrAlbumTitle.replace(/"/g, '\\\\"')
    }"\n`;
  }
  if (post.featureType) frontmatter += `featureType: ${post.featureType}\n`;
  if (post.releaseDate) frontmatter += `releaseDate: ${post.releaseDate}\n`;
  if (post.producers && post.producers.length > 0) {
    frontmatter += `producers: [${
      post.producers.map((p) => `"${p.replace(/"/g, '\\\\"')}"`).join(", ")
    }]\n`;
  }
  if (post.albumCoverUrl) {
    frontmatter += `albumCoverUrl: ${post.albumCoverUrl}\n`;
  }
  if (post.spotifyLink) frontmatter += `spotifyLink: ${post.spotifyLink}\n`;
  if (post.appleMusicLink) {
    frontmatter += `appleMusicLink: ${post.appleMusicLink}\n`;
  }
  frontmatter += "---\n\n";

  let body = "";
  if (post.description) {
    body += `## Description\n${post.description}\n\n`;
  } else if (post.textContent) {
    body += `## Text Content\n${post.textContent}\n\n`;
  }

  body += "## Raw Reddit Data\n";
  body += `Title: ${post.title}\n`;
  body += `Flair: ${post.flair || "N/A"}\n`;
  body += `Reddit Link: ${post.redditLink}\n`;
  body += `Source URL: ${post.sourceUrl}\n`;

  return frontmatter + body;
}

export async function writeDebugMarkdownFile(post: ProcessedRedditPost) {
  if (!config.debug.generateMarkdownFiles) {
    return;
  }

  await ensureDir(config.debug.markdownDebugPath);

  const markdownContent = generateMarkdownContent(post);
  // Sanitize filename
  const filename = `${post.id}_${
    post.title.replace(/[^a-z0-9_\-]+/gi, "_").toLowerCase()
  }.md`;
  const filePath = `${config.debug.markdownDebugPath}/${filename}`;

  try {
    await Deno.writeTextFile(filePath, markdownContent);
    console.log(`Debug markdown file written to: ${filePath}`);
  } catch (error) {
    console.error(`Error writing debug markdown file ${filePath}:`, error);
  }
}
