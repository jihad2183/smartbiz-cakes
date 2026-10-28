export const CAKE_PAGE_SIZE = 12;

export function getCakePageCount(total: number) {
  return Math.ceil(Math.max(0, Number.isFinite(total) ? total : 0) / CAKE_PAGE_SIZE);
}

export function getCakePageRange(page: number) {
  const safePage = Math.max(1, Math.floor(page));
  return {
    from: (safePage - 1) * CAKE_PAGE_SIZE,
    to: safePage * CAKE_PAGE_SIZE - 1,
  };
}
