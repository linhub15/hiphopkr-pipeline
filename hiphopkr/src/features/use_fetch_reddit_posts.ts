import { useMutation } from "@tanstack/react-query";
import { fetchFromReddit } from "./fetch_from_reddit";

export function useFetchRedditPosts() {
	return useMutation({
		mutationFn: async () => {
			await fetchFromReddit();
		},
	});
}
