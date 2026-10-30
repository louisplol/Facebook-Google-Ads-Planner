export interface CloseOptions {
  onePayment: number | null;
  monthly: number | null;
  months: 3;
  formula: string;
  inputs: { offerPrice: number | null; uplift: number | null };
}

/**
 * Two options, both a yes: one payment at the offer price, or 3 monthly payments of
 * offer price x (1 + uplift) / 3. Uplift is blank by default (treated as 0 only when the user enters 0).
 */
export function closeOptions(offerPrice: number | null, uplift: number | null): CloseOptions {
  const formula = "Monthly = offer price x (1 + extra for paying over 3 months) / 3";
  if (offerPrice === null || !Number.isFinite(offerPrice)) {
    return { onePayment: null, monthly: null, months: 3, formula, inputs: { offerPrice, uplift } };
  }
  const u = uplift === null || !Number.isFinite(uplift) ? null : uplift;
  return {
    onePayment: offerPrice,
    monthly: u === null ? null : (offerPrice * (1 + u)) / 3,
    months: 3,
    formula,
    inputs: { offerPrice, uplift: u },
  };
}
