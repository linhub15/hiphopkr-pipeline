import { message } from "@tauri-apps/plugin-dialog";
import { confirm } from "@tauri-apps/plugin-dialog";
import { clearRedditPosts } from "@/lib/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useClearPosts() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			const confirmed = await confirm(
				"Are you sure you want to permanently clear all posts in this tool? You will need to refetch from Reddit. This does not impact wordpress.",
				{ title: "Clear Posts", kind: "warning" },
			);
			if (confirmed) {
				await clearRedditPosts();
				await queryClient.invalidateQueries({ queryKey: ["reddit_posts"] });
				await message("Success! All posts cleared", {
					title: "Success",
					kind: "info",
				});
			}
		},
	});
}
