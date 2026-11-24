import type { NubeSDK } from "@tiendanube/nube-sdk-types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./main";

function mockNube(): Partial<NubeSDK> {
	return {
		on: vi.fn(),
		getState: vi.fn(() => ({ store: { id: 123 } }) as unknown as ReturnType<NubeSDK["getState"]>),
		getBrowserAPIs: vi.fn(
			() =>
				({
					asyncLocalStorage: {
						getItem: vi.fn(async () => "anon-1"),
						setItem: vi.fn(async () => {}),
						removeItem: vi.fn(async () => {}),
					},
				}) as unknown as ReturnType<NubeSDK["getBrowserAPIs"]>,
		),
	};
}

const CONFIG = { host: "https://app.test", account: "acc", dataset: "ds", environment: "prod", writeKey: "wk" };

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("App (bridge de tracking)", () => {
	it("registra los handlers clave cuando hay config", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({ ok: true, json: async () => CONFIG }) as unknown as Response),
		);

		const nube = mockNube();
		await App(nube as NubeSDK);

		const registered = (nube.on as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
		for (const ev of ["page:loaded", "cart:update", "cart:add:success", "order:update", "checkout:success", "customer:update"]) {
			expect(registered).toContain(ev);
		}
	});

	it("no registra nada si no resuelve config", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({ ok: false, json: async () => ({}) }) as unknown as Response),
		);

		const nube = mockNube();
		await App(nube as NubeSDK);

		expect(nube.on).not.toHaveBeenCalled();
	});
});
