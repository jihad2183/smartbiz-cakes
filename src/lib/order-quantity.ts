export const MAX_ORDER_QUANTITY = 50;

export const isValidQuantity = (quantity: number) =>
  Number.isSafeInteger(quantity) && quantity > 0 && quantity <= MAX_ORDER_QUANTITY;
