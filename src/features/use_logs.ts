import { listLogs } from "@/lib/db";
import { useQuery } from "@tanstack/react-query";

export function useLogs() {
	return useQuery({
		queryKey: ["logs"],
		queryFn: async () => {
			return await listLogs();
		},
	});
}
