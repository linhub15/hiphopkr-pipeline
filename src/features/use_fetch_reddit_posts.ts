import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchFromReddit } from "./fetch_from_reddit";

export function useFetchRedditPosts() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			await fetchFromReddit();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["reddit_posts"] });
		},
	});
}
