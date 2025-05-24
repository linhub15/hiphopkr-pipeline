import type { Config } from "@/lib/config.type";
import { setConfig } from "@/lib/db";
import { useMutation } from "@tanstack/react-query";

export function useSaveConfig() {
	return useMutation({
		mutationFn: async (request: Config) => {
			return await setConfig(request);
		},
	});
}
