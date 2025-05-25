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
				alert("Please select at least one post to publish.");
				return;
			}

			const posts = await listRedditPostsById(args.postIds);

			for (const post of posts) {
				await createWordPressPost(
					post.data as ProcessedRedditPost,
					authTokenBase64,
					args.wordpressEndpoint,
				);
			}
		},
	});
}
