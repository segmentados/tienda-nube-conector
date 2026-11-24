import type { Cart, Customer, Store } from "@tiendanube/nube-sdk-types";

/**
 * Normaliza un monto. VALIDAR EN TIENDA DEMO: confirmar si `Cart.prices.*` viene en UNIDADES o en CENTAVOS.
 * Los tipos lo declaran `number`; el connector de import de la API REST maneja unidades, pero el storefront
 * histórico (objeto `LS`) exponía centavos. Si en el spike resulta centavos, dividir acá por 100.
 */
function money(n: number | undefined | null): number | undefined {
	return typeof n === "number" ? n : undefined;
}

/** Líneas del carrito/orden mapeadas a nuestro contrato (Sku/Title/Qty/UnitPrice/LineTotal). */
export function lineItems(cart?: Cart) {
	return (cart?.items ?? []).map((i) => {
		const unitPrice = Number(i.price);
		return {
			productId: i.product_id,
			variantId: i.variant_id,
			title: i.name,
			quantity: i.quantity,
			unitPrice: Number.isFinite(unitPrice) ? unitPrice : undefined,
			lineTotal: Number.isFinite(unitPrice) ? unitPrice * i.quantity : undefined,
		};
	});
}

/** Props de carrito/orden: totales + líneas + moneda. */
export function cartProps(cart?: Cart, store?: Store) {
	const p = cart?.prices;
	const discount =
		(p?.discount_coupon ?? 0) + (p?.discount_promotion ?? 0) + (p?.discount_gateway ?? 0);
	return {
		cartId: cart?.id,
		currency: store?.currency_details?.code ?? store?.currency,
		subtotal: money(p?.subtotal),
		discount: money(discount),
		shipping: money(p?.shipping),
		total: money(p?.total),
		itemCount: cart?.items?.length ?? 0,
		items: lineItems(cart),
	};
}

/** Traits del cliente para /identify (email/nombre/teléfono + atributos). */
export function customerTraits(customer?: Customer | null) {
	const contact = customer?.contact ?? null;
	const email = customer?.email ?? contact?.email ?? undefined;
	const name = customer?.name ?? contact?.name ?? undefined;
	const phone = customer?.phone ?? contact?.phone ?? undefined;
	return {
		email: email ?? undefined,
		firstName: name ?? undefined,
		phone: phone ?? undefined,
		traits: {
			customerId: customer?.id ?? undefined,
			acceptsMarketing: contact?.accepts_marketing ?? undefined,
		},
	};
}
