import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem, MenuItem } from '../../../shared/types';

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  tax: number;
  total: number;
  notes: string;
  isCartOpen: boolean;
  setNotes: (notes: string) => void;
  addItem: (item: MenuItem, quantity?: number) => void;
  updateQuantity: (menuItemId: number, quantity: number) => void;
  removeItem: (menuItemId: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const TAX_RATE = 0.05; // 5% GST

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('cafe_cart_items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [notes, setNotes] = useState<string>(() => {
    return localStorage.getItem('cafe_cart_notes') || '';
  });

  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('cafe_cart_items', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('cafe_cart_notes', notes);
  }, [notes]);

  const addItem = (menuItem: MenuItem, quantity: number = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.menuItem.id === menuItem.id);
      if (existing) {
        return prev.map(i =>
          i.menuItem.id === menuItem.id
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [...prev, { menuItem, quantity }];
    });
  };

  const updateQuantity = (menuItemId: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(menuItemId);
      return;
    }
    setItems(prev =>
      prev.map(i =>
        i.menuItem.id === menuItemId
          ? { ...i, quantity }
          : i
      )
    );
  };

  const removeItem = (menuItemId: number) => {
    setItems(prev => prev.filter(i => i.menuItem.id !== menuItemId));
  };

  const clearCart = () => {
    setItems([]);
    setNotes('');
    localStorage.removeItem('cafe_cart_items');
    localStorage.removeItem('cafe_cart_notes');
  };

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);

  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const rawSubtotal = items.reduce((acc, item) => acc + item.menuItem.price * item.quantity, 0);
  const subtotal = Number(rawSubtotal.toFixed(2));
  const tax = Number((subtotal * TAX_RATE).toFixed(2));
  const total = Number((subtotal + tax).toFixed(2));

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        subtotal,
        tax,
        total,
        notes,
        isCartOpen,
        setNotes,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        openCart,
        closeCart
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
