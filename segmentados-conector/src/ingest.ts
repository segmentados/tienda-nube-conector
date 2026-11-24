import type { NubeSDK } from "@tiendanube/nube-sdk-types";
import type { SegConfig } from "./config";

const ANON_KEY = "seg_anon_id";
const ANON_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 año

function newId(): string {
	try {
		// El Web Worker tiene `crypto`.
		return (globalThis.crypto as Crypto).randomUUID();
	} catch {
		return `a-${Date.now()}-${Math.random().toString(16).slice(2)}`;
	}
}

/**
 * Cliente de la ingesta pública de Segmentados (estilo Segment: /event, /identify, /page).
 * Endpoint: {host}/t/{account}/{dataset}/{environment}/{path} con write-key en el body.
 * El `anonymousId` se persiste en el storage async de NubeSDK (TTL 1 año) para tener un visitante estable.
 */
export class Ingest {
	private anonId: string | null = null;

	constructor(
		private readonly nube: NubeSDK,
		private readonly cfg: SegConfig,
	) {}

	private url(path: string): string {
		const { host, account, dataset, environment } = this.cfg;
		return `${host.replace(/\/$/, "")}/t/${account}/${dataset}/${environment}/${path}`;
	}

	private async anonymousId(): Promise<string> {
		if (this.anonId) return this.anonId;
		try {
			const storage = this.nube.getBrowserAPIs().asyncLocalStorage;
			let id = await storage.getItem(ANON_KEY);
			if (!id) {
				id = newId();
				await storage.setItem(ANON_KEY, id, ANON_TTL_SECONDS);
			}
			this.anonId = id;
			return id;
		} catch {
			// Sin storage, usamos uno efímero por carga (mejor que nada).
			this.anonId = newId();
			return this.anonId;
		}
	}

	private async post(path: string, body: Record<string, unknown>): Promise<void> {
		const anonymousId = await this.anonymousId();
		const payload: Record<string, unknown> = { writeKey: this.cfg.writeKey, anonymousId, ...body };
		try {
			await fetch(this.url(path), {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload),
				keepalive: true, // que el envío sobreviva a una navegación (ej. checkout).
			});
		} catch (e) {
			console.warn("[segmentados] fallo al enviar", path, e);
		}
	}

	track(event: string, properties: Record<string, unknown>, extra: Record<string, unknown> = {}): Promise<void> {
		return this.post("event", { event, properties, ...extra });
	}

	identify(body: Record<string, unknown>): Promise<void> {
		return this.post("identify", body);
	}

	page(body: Record<string, unknown>): Promise<void> {
		return this.post("page", body);
	}
}
