// news_content_extractor.ts
import type { ProcessedRedditPost } from "./reddit_client.ts";
// You might need an HTML parser if fetching content from external links
// Example: import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

export async function extractNewsContent(post: ProcessedRedditPost): Promise<ProcessedRedditPost> {
  if (post.featureType !== 'news' && post.featureType !== 'rumor') {
    return post;
  }

  if (post.textContent && post.textContent.trim() !== "") {
    // Text is already from Reddit selftext
    post.description = post.textContent; // Use selftext as the main description
    return post;
  }

  // If it's a link post, try to fetch and parse the content from post.sourceUrl
  // This is complex and error-prone due to varying website structures.
  // A generic article extractor is a project in itself.
  if (post.sourceUrl && !post.domain.includes('reddit.com') && !post.domain.includes('redd.it')) {
    try {
      console.log(`Workspaceing external content for news: ${post.sourceUrl}`);
      const response = await fetch(post.sourceUrl, {
          headers: { 'User-Agent': 'KhiphopPipelineBot/1.0 (+https://yourcontactinfo.com)' } // Be a good bot
      });
      if (response.ok && response.headers.get("content-type")?.includes("text/html")) {
        const html = await response.text();
        // TODO: Implement robust HTML parsing to extract main article content
        // Using a library like DOMParser and trying to find common article tags
        // const doc = new DOMParser().parseFromString(html, "text/html");
        // const articleBody = doc?.querySelector('article, .post-content, .entry-content, [role="main"]');
        // if (articleBody) {
        //   post.description = articleBody.textContent.trim().substring(0, 2000); // Limit length
        // } else {
        //   post.description = `Could not automatically extract content. Visit link: ${post.sourceUrl}`;
        // }
        post.description = `(Content from external link: ${post.sourceUrl} - needs manual summary or improved extractor)`;
      } else {
         post.description = `Failed to fetch or not HTML content from ${post.sourceUrl}. Status: ${response.status}`;
      }
    } catch (error) {
      console.error(`Error fetching external content from ${post.sourceUrl}:`, error);
      post.description = `Error fetching content from link. Visit: ${post.sourceUrl}`;
    }
  } else if (!post.textContent) {
      post.description = "No text content provided in Reddit post or linked article.";
  }

  return post;
}