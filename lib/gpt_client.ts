// gpt_client.ts
import { config } from "../src/config.ts";
import type { ProcessedRedditPost } from "./reddit_client.ts";

export async function generateSynopsis(
  post: ProcessedRedditPost,
): Promise<ProcessedRedditPost> {
  if (!config.openai.apiKey) {
    console.warn(
      "OpenAI API key not configured. Skipping synopsis generation.",
    );
    return post;
  }

  let promptContent = "";
  if (post.featureType === "news" || post.featureType === "rumor") {
    if (!post.description || post.description.length < 50) { // Only if there's substantial text
      console.log("Not enough content for news synopsis:", post.title);
      return post;
    }
    promptContent =
      `Generate a concise, SEO-friendly news summary (around 100-150 words) for a blog post about the following Korean hip-hop news. Highlight key information. News content: "${post.description}"`;
  } else if (["track", "album", "ep", "mv"].includes(post.featureType!)) {
    if (!post.artist || !post.trackOrAlbumTitle) return post; // Not enough info
    promptContent =
      `Generate a short, engaging, and SEO-friendly synopsis (around 100-150 words) for a blog post about the Korean hip-hop ${post.featureType} release titled "${post.trackOrAlbumTitle}" by "${post.artist}". Mention the artist and title. If available, incorporate release date: ${post.releaseDate}. Available description/details: "${
        post.description || "None"
      }"`;
  } else {
    return post; // Not applicable
  }

  try {
    const response = await fetch(config.openai.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.openai.apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo", // Or gpt-4 if you have access and budget
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that writes concise summaries for a Korean Hip-Hop news and music blog.",
          },
          { role: "user", content: promptContent },
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `OpenAI API error: ${response.status} ${await response.text()}`,
      );
    }
    const data = await response.json();
    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
      post.description = data.choices[0].message.content.trim(); // Overwrite or add to a new field 'generatedSynopsis'
    } else {
      console.warn("OpenAI response malformed:", data);
    }
  } catch (error) {
    console.error("Error generating synopsis with OpenAI:", error);
  }
  return post;
}
