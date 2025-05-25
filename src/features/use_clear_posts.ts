import { clearRedditPosts } from "@/lib/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useClearPosts() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			const confirmed = confirm(
				"Are you sure you want to permanently clear all posts in this tool? You will need to refetch from Reddit. This does not impact wordpress.",
			);
			if (confirmed) {
				await clearRedditPosts();
				queryClient.invalidateQueries({ queryKey: ["reddit_posts"] });
				alert("Success! All posts cleared");
			}
		},
	});
}
