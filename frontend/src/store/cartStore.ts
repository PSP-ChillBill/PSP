import { create } from 'zustand';

interface CartItem {
  optionId: number;
  catalogItemId: number;
  itemName: string;
  optionName?: string;
  unitPrice: number;
  qty: number;
  taxRate: number;
}

interface CartState {
  items: CartItem[];
  orderId: number | null;
  addItem: (item: CartItem) => void;
  updateQty: (optionId: number, qty: number) => void;
  removeItem: (optionId: number) => void;
  clearCart: () => void;
  setOrderId: (orderId: number | null) => void;
  getSubtotal: () => number;
  getTaxTotal: () => number;
  getTotal: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  orderId: null,

  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.optionId === item.optionId);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.optionId === item.optionId ? { ...i, qty: i.qty + item.qty } : i
          ),
        };
      }
      return { items: [...state.items, item] };
    }),

  updateQty: (optionId, qty) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.optionId === optionId ? { ...i, qty } : i
      ),
    })),

  removeItem: (optionId) =>
    set((state) => ({
      items: state.items.filter((i) => i.optionId !== optionId),
    })),

  clearCart: () => set({ items: [], orderId: null }),

  setOrderId: (orderId) => set({ orderId }),

  getSubtotal: () => {
    const items = get().items;
    return items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
  },

  getTaxTotal: () => {
    const items = get().items;
    return items.reduce(
      (sum, item) =>
        sum + item.unitPrice * item.qty * (item.taxRate / 100),
      0
    );
  },

  getTotal: () => {
    return get().getSubtotal() + get().getTaxTotal();
  },
}));
