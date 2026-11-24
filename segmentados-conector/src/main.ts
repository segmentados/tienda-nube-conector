import type { NubeSDK, NubeSDKState } from "@tiendanube/nube-sdk-types";
import { resolveConfig } from "./config";
import { Ingest } from "./ingest";
import { cartProps, customerTraits } from "./mappers";

/** `state.eventPayload` existe en los eventos `*:success`/payload; lo leemos defensivamente. */
function payloadOf(state: unknown): Record<string, unknown> | undefined {
	const p = (state as { eventPayload?: unknown })?.eventPayload;
	return p && typeof p === "object" ? (p as Record<string, unknown>) : undefined;
}

export async function App(nube: NubeSDK) {
	const cfg = await resolveConfig(nube);
	if (!cfg) return; // sin config no hace nada (ya avisó por consola).
	const ingest = new Ingest(nube, cfg);

	// --- SPIKE (quitar tras validar): loguear el state crudo de los eventos clave para confirmar los campos
	//     reales (montos en centavos vs unidades, shape de order/customer) con NubeSDK DevTools en la tienda demo. ---
	const SPIKE = true;
	const spike = (label: string, state: NubeSDKState) => {
		if (SPIKE) console.log("[seg:spike]", label, JSON.parse(JSON.stringify(state)));
	};

	// ── Page view ──────────────────────────────────────────────────────────────────────────────────
	nube.on("page:loaded", (state) => {
		spike("page:loaded", state);
		void ingest.page({ domain: state.store?.domain });
	});

	// ── Product viewed (PDP) ─────────────────────────────────────────────────────────────────────────
	nube.on("product:variant_selected", (state) => {
		spike("product:variant_selected", state);
		void ingest.track("Product Viewed", { ...payloadOf(state) });
	});

	// ── Carrito ─────────────────────────────────────────────────────────────────────────────────────
	nube.on("cart:add:success", (state) => {
		void ingest.track("Product Added", { ...payloadOf(state), ...cartProps(state.cart, state.store) });
	});
	nube.on("cart:remove:success", (state) => {
		void ingest.track("Product Removed", { ...payloadOf(state), ...cartProps(state.cart, state.store) });
	});
	nube.on("cart:update", (state) => {
		void ingest.track("Cart Updated", cartProps(state.cart, state.store));
	});

	// ── Order completed (la conversión) ──────────────────────────────────────────────────────────────
	//    `order:update` se despacha en la página de éxito; `order` es fino (status/tracking), así que los
	//    importes/líneas salen del cart. Escuchamos ambos y dedup simple por orden ya enviada.
	let orderSent = false;
	const onOrder = (state: NubeSDKState) => {
		if (orderSent) return;
		orderSent = true;
		spike("order", state);
		void ingest.track("Order Completed", {
			...cartProps(state.cart, state.store),
			orderStatus: state.order?.status ?? undefined,
		});
	};
	nube.on("order:update", onOrder);
	nube.on("checkout:success", onOrder);

	// ── Identify (cliente logueado) ──────────────────────────────────────────────────────────────────
	nube.on("customer:update", (state) => {
		spike("customer:update", state);
		const traits = customerTraits(state.customer);
		if (traits.email || traits.phone) void ingest.identify(traits);
	});
}
