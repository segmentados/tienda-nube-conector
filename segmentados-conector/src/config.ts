import type { NubeSDK } from "@tiendanube/nube-sdk-types";

/**
 * Config de Segmentados para una tienda: a qué cuenta/dataset/entorno manda los eventos y con qué write-key.
 * Se resuelve por `store.id` contra nuestro backend (el OAuth install mapea store_id → marca/entorno + write-key).
 */
export type SegConfig = {
	host: string; // ej. https://app.segmentados.com.ar
	account: string;
	dataset: string;
	environment: string;
	writeKey: string;
};

/**
 * Fallback SOLO para el spike/tienda demo, hasta que exista el endpoint de mapeo store_id→cuenta en el backend.
 * Completá account/dataset/environment/writeKey con los de una cuenta de prueba para validar end-to-end.
 * En producción NO se usa: la config la devuelve el backend por store_id.
 */
const DEV_FALLBACK: Partial<SegConfig> = {
	host: "https://app.segmentados.online",
	// account: "",
	// dataset: "",
	// environment: "",
	// writeKey: "",
};

function isComplete(c: Partial<SegConfig>): c is SegConfig {
	return Boolean(c.host && c.account && c.dataset && c.environment && c.writeKey);
}

export async function resolveConfig(nube: NubeSDK): Promise<SegConfig | null> {
	const store = nube.getState().store;
	const storeId = store?.id;
	const host = (DEV_FALLBACK.host ?? "").replace(/\/$/, "");

	// 1) Resolución real: nuestro backend mapea store_id → {account, dataset, environment, writeKey}.
	//    TODO(backend): implementar GET /api/tiendanube/config?store_id=... (lo crea el OAuth install).
	if (storeId && host) {
		try {
			const res = await fetch(`${host}/api/tiendanube/config?store_id=${encodeURIComponent(String(storeId))}`, {
				headers: { accept: "application/json" },
			});
			if (res.ok) {
				const c = (await res.json()) as Partial<SegConfig>;
				const resolved = { host: c.host ?? host, account: c.account, dataset: c.dataset, environment: c.environment, writeKey: c.writeKey } as Partial<SegConfig>;
				if (isComplete(resolved)) {
					return resolved;
				}
			}
		} catch (e) {
			console.warn("[segmentados] no se pudo resolver config por store_id; se intenta el fallback dev.", e);
		}
	}

	// 2) Fallback dev (spike).
	if (isComplete(DEV_FALLBACK)) {
		return { ...DEV_FALLBACK };
	}

	console.warn(
		"[segmentados] sin config (account/dataset/environment/writeKey). Tracking deshabilitado hasta mapear la tienda " +
			`(store_id=${storeId ?? "?"}).`,
	);
	return null;
}
