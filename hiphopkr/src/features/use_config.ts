import { getConfig } from "@/lib/db";
import { useQuery } from "@tanstack/react-query";

export function useConfig() {
	return useQuery({
		queryKey: ["config"],
		queryFn: async () => {
			return await getConfig();
		},
	});
}
