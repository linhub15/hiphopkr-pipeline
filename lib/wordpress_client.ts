// wordpress_client.ts
import { config } from "../src/config.ts";
import type { ProcessedRedditPost } from "./reddit_client.ts";

// Helper function to upload media (album cover) to WordPress
async function uploadMediaToWordPress(
  imageUrl: string,
  title: string,
  authToken: string,
): Promise<number | null> {
  if (!imageUrl) return null;

  try {
    // Fetch the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      console.error(
        `Failed to download image from ${imageUrl}: ${imageResponse.status}`,
      );
      return null;
    }
    const imageBlob = await imageResponse.blob();
    const originalFileName =
      imageUrl.substring(imageUrl.lastIndexOf("/") + 1) ||
      `${title.replace(/\s+/g, "-")}-cover`;
    // Ensure a common extension if missing, or derive from blob.type
    const fileName = originalFileName.includes(".")
      ? originalFileName
      : `${originalFileName}.${imageBlob.type.split("/")[1] || "jpg"}`;

    const formData = new FormData();
    formData.append("file", imageBlob, fileName);
    formData.append("title", `${title} Album Cover`);
    formData.append("alt_text", `${title} - Cover Art`);
    // formData.append("caption", `Cover art for ${title}`); // Optional

    const mediaResponse = await fetch(
      `${config.wordpress.endpoint}/wp/v2/media`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${authToken}`,
          // Content-Disposition and Content-Type are typically handled by FormData
        },
        body: formData,
      },
    );

    if (!mediaResponse.ok) {
      const errorText = await mediaResponse.text();
      console.error(
        `Failed to upload media to WordPress: ${mediaResponse.status} - ${errorText}`,
      );
      return null;
    }
    const mediaData = await mediaResponse.json();
    return mediaData.id;
  } catch (error) {
    console.error("Error uploading media to WordPress:", error);
    return null;
  }
}

function generatePostContent(post: ProcessedRedditPost): string {
  // Basic HTML template. You can make this much more sophisticated.
  let content = ``;

  if (
    post.albumCoverUrl && post.featureType !== "news" &&
    post.featureType !== "rumor"
  ) {
    // Featured image will be set separately, but you can include it in content too
    // content += `<figure class="wp-block-image size-large"><img src="${post.albumCoverUrl}" alt="${post.trackOrAlbumTitle} by ${post.artist} - Cover Art"></figure>\n\n`;
  }

  if (
    post.artist && post.trackOrAlbumTitle && post.featureType !== "news" &&
    post.featureType !== "rumor"
  ) {
    content += `<p><strong>Artist:</strong> ${post.artist}</p>\n`;
    content += `<p><strong>Title:</strong> ${post.trackOrAlbumTitle}</p>\n`;
  }
  if (
    post.releaseDate && post.featureType !== "news" &&
    post.featureType !== "rumor"
  ) {
    content += `<p><strong>Release Date:</strong> ${post.releaseDate}</p>\n`;
  }
  if (
    post.producers && post.producers.length > 0 &&
    post.featureType !== "news" && post.featureType !== "rumor"
  ) {
    content += `<p><strong>Producer(s):</strong> ${
      post.producers.join(", ")
    }</p>\n\n`;
  }

  if (post.description) {
    content += `<h2>Synopsis</h2>\n<p>${
      post.description.replace(/\n/g, "<br>")
    }</p>\n\n`;
  }

  if (post.spotifyLink || post.appleMusicLink) {
    content += `<h2>Stream/Listen</h2>\n<ul>\n`;
    if (post.spotifyLink) {
      content +=
        `  <li><a href="${post.spotifyLink}" target="_blank" rel="noopener noreferrer">Spotify</a></li>\n`;
    }
    if (post.appleMusicLink) { // Assuming you might add this later
      content +=
        `  <li><a href="${post.appleMusicLink}" target="_blank" rel="noopener noreferrer">Apple Music</a></li>\n`;
    }
    content += `</ul>\n\n`;
  }

  content +=
    `<p><em>Source: <a href="${post.redditLink}" target="_blank" rel="noopener noreferrer">r/khiphop on Reddit</a>`;
  if (
    post.sourceUrl !== post.redditLink &&
    !post.sourceUrl.includes("i.redd.it") &&
    !post.sourceUrl.includes("v.redd.it")
  ) {
    content +=
      ` | <a href="${post.sourceUrl}" target="_blank" rel="noopener noreferrer">Original Source</a>`;
  }
  content += `</em></p>\n`;

  // Add SEO keywords/tags based on flair, artist, title later via categories/tags
  return content;
}

function generatePostTitle(post: ProcessedRedditPost): string {
  // SEO-friendly title
  let prefix = "";
  if (post.featureType === "mv") prefix = "Watch MV:";
  else if (post.featureType === "album" || post.featureType === "ep") {
    prefix = "New Album/EP:";
  } else if (post.featureType === "track") prefix = "New Track:";
  else if (post.featureType === "news") prefix = "K-Hip Hop News:";
  else if (post.featureType === "rumor") prefix = "Rumor Mill:";

  if (
    post.artist && post.trackOrAlbumTitle &&
    (post.featureType !== "news" && post.featureType !== "rumor")
  ) {
    return `${prefix} ${post.artist} – "${post.trackOrAlbumTitle}"`.trim();
  }
  // For news/rumor, the Reddit title is often good, or use the extracted title
  return `${prefix} ${post.title}`.trim();
}

// Placeholder for getting category/tag IDs
async function getTermIds(
  name: string,
  taxonomy: "category" | "post_tag",
  authToken: string,
): Promise<number[]> {
  // In a real scenario, you'd search for the term or create it if it doesn't exist.
  // For now, let's assume you have predefined category/tag IDs or handle this manually.
  // Example: if name is 'Music Video', return ID for 'Music Videos' category.
  const termMap: Record<string, Record<string, number>> = {
    mv: { category: 10, post_tag: 25 }, // Replace with actual IDs
    album: { category: 11, post_tag: 26 },
    track: { category: 12, post_tag: 27 },
    news: { category: 15, post_tag: 30 },
  };
  const lowerFeatureType = post.featureType?.toLowerCase();
  if (
    lowerFeatureType && termMap[lowerFeatureType] &&
    termMap[lowerFeatureType][taxonomy]
  ) {
    return [termMap[lowerFeatureType][taxonomy]];
  }
  return [];
}

export async function createWordPressDraft(post: ProcessedRedditPost) {
  const authToken = btoa(
    `${config.wordpress.username}:${config.wordpress.password}`,
  );
  let featuredMediaId: number | null = null;

  // Upload album cover as featured image if it's a music release
  if (
    post.albumCoverUrl &&
    ["track", "album", "ep", "mv"].includes(post.featureType!)
  ) {
    console.log(`Uploading media for: ${post.title}`);
    featuredMediaId = await uploadMediaToWordPress(
      post.albumCoverUrl,
      `${post.artist || ""} ${post.trackOrAlbumTitle || post.title}`,
      authToken,
    );
  }

  const wpPost = {
    title: generatePostTitle(post),
    content: generatePostContent(post),
    status: "draft", //  Important: create as draft
    // SEO: Set categories and tags. You'll need to map flairs/types to WordPress category/tag IDs.
    // categories: await getTermIds(post.featureType, 'category', authToken), // Example: [1, 2]
    // tags: await getTermIds(post.artist, 'post_tag', authToken), // Example: [3, 4]
    // featured_media: featuredMediaId, // Set after uploading image
    // You might also want to set excerpt, author, etc.
  };

  if (featuredMediaId) {
    (wpPost as any).featured_media = featuredMediaId;
  }

  // Add categories and tags based on flair and artist
  const categories: number[] = [];
  const tags: number[] = [];

  // Simplistic mapping - ideally fetch term IDs by name or have a config map
  if (post.flair) {
    // This is a placeholder. You need a robust way to map flairs to WP category/tag IDs.
    // Example: if post.flair.toLowerCase().includes('music video'), add MV category ID.
    // categories.push(getCategoryIdForFlair(post.flair));
  }
  if (post.artist) {
    // tags.push(getTagIdForArtist(post.artist)); // Again, placeholder
  }
  // Add a general "K-Hip Hop" category?
  // wpPost.categories = categories.filter(id => id > 0);
  // wpPost.tags = tags.filter(id => id > 0);

  try {
    const response = await fetch(`${config.wordpress.endpoint}/wp/v2/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${authToken}`,
      },
      body: JSON.stringify(wpPost),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("WordPress API Error creating post:", errorData);
      throw new Error(
        `Failed to create WordPress draft: ${response.status} - ${
          JSON.stringify(errorData)
        }`,
      );
    }
    const createdPost = await response.json();
    console.log(
      `WordPress draft created: ${createdPost.id} - ${createdPost.link}`,
    );
    return createdPost;
  } catch (error) {
    console.error("Error creating WordPress draft:", error);
    return null;
  }
}
