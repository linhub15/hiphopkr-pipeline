import type { Config } from "@/lib/config.type";
import { setConfig } from "@/lib/db";
import { useMutation } from "@tanstack/react-query";
import { message } from "@tauri-apps/plugin-dialog";

export function useSaveConfig() {
	return useMutation({
		mutationFn: async (request: Config) => {
			await setConfig(request);
			await message("Config saved successfully", {
				title: "Saved",
				kind: "info",
			});
			return;
		},
	});
}
