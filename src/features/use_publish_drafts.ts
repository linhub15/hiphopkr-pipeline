import { message } from "@tauri-apps/plugin-dialog";
import { listRedditPostsById } from "@/lib/db";
import type { ProcessedRedditPost } from "@/lib/reddit_client";
import { createWordPressPost } from "@/lib/wordpress_client";
import { useMutation } from "@tanstack/react-query";

type Args = {
	postIds: string[];
	wordpressEndpoint: string;
	wordpressUsername: string;
	wordpressPassword: string;
};

export function usePublishDrafts() {
	return useMutation({
		mutationFn: async (args: Args) => {
			const authTokenBase64 = btoa(
				`${args.wordpressUsername}:${args.wordpressPassword}`,
			);

			if (args.postIds.length === 0) {
				await message("Please select at least one post to publish.", {
					title: "Missing selection",
					kind: "warning",
				});
				return;
			}

			const posts = await listRedditPostsById(args.postIds);
			let successCount = 0;

			for (const post of posts) {
				try {
					await createWordPressPost(
						post.data as ProcessedRedditPost,
						authTokenBase64,
						args.wordpressEndpoint,
					);
					successCount++;
				} catch (error) {
					console.error("Error publishing post:", error);
				}
			}

			await message(`Successfully published ${successCount} posts`);
		},
	});
}
