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

			const posts = [];

			for (const post of posts) {
				await createWordPressPost(
					post,
					authTokenBase64,
					args.wordpressEndpoint,
				);
			}
		},
	});
}
