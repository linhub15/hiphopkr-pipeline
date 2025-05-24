import { listRedditPosts } from "@/lib/db";
import { useQuery } from "@tanstack/react-query";

export function useRedditPosts() {
	return useQuery({
		queryKey: ["reddit_posts"],
		queryFn: async () => {
			return await listRedditPosts();
		},
	});
}
