import React, { useState } from 'react';
import { MenuItem } from '../../../shared/types';
import { useCart } from '../../context/CartContext';
import { X, Plus, Minus, Flame, Leaf, ShoppingBag, Check } from 'lucide-react';

interface DishDetailModalProps {
  item: MenuItem | null;
  onClose: () => void;
}

export const DishDetailModal: React.FC<DishDetailModalProps> = ({ item, onClose }) => {
  const { addItem, items, updateQuantity } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  if (!item) return null;

  const existingInCart = items.find(i => i.menuItem.id === item.id);

  const handleAddToCart = () => {
    addItem(item, quantity);
    setAdded(true);
    setTimeout(() => {
      setAdded(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg overflow-hidden bg-white rounded-3xl shadow-2xl border border-cafe-200 animate-scaleUp">
        {/* Dish Image */}
        <div className="relative h-64 sm:h-72 w-full bg-cafe-100 overflow-hidden">
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
          
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full transition-all"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Badges on image */}
          <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
            {item.is_veg && (
              <span className="px-3 py-1 text-xs font-bold bg-emerald-600/90 backdrop-blur-md text-white rounded-full flex items-center gap-1 shadow">
                <Leaf className="w-3.5 h-3.5" /> 100% Vegetarian
              </span>
            )}
            {item.is_spicy && (
              <span className="px-3 py-1 text-xs font-bold bg-red-600/90 backdrop-blur-md text-white rounded-full flex items-center gap-1 shadow">
                <Flame className="w-3.5 h-3.5" /> Spicy
              </span>
            )}
            {item.category_name && (
              <span className="px-3 py-1 text-xs font-semibold bg-cafe-900/80 backdrop-blur-md text-cafe-100 rounded-full shadow">
                {item.category_name}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-3">
            <h3 className="text-2xl font-serif font-bold text-cafe-950 leading-tight">
              {item.name}
            </h3>
            <span className="text-2xl font-bold text-cafe-800 whitespace-nowrap">
              ₹{item.price.toFixed(2)}
            </span>
          </div>

          <p className="text-sm text-cafe-700 leading-relaxed mb-6">
            {item.description}
          </p>

          <div className="pt-4 border-t border-cafe-100 flex items-center justify-between gap-4">
            {/* Quantity Stepper */}
            <div className="flex items-center gap-3 bg-cafe-100/80 p-1.5 rounded-2xl border border-cafe-200">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white text-cafe-800 shadow-sm hover:bg-cafe-50 active:scale-95 transition-all"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-6 text-center font-bold text-cafe-900 text-base">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(q => q + 1)}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white text-cafe-800 shadow-sm hover:bg-cafe-50 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Add to Cart Button */}
            <button
              onClick={handleAddToCart}
              disabled={added}
              className={`flex-1 py-3.5 px-6 rounded-2xl font-semibold text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
                added
                  ? 'bg-emerald-600 shadow-emerald-600/20'
                  : 'bg-cafe-800 hover:bg-cafe-900 shadow-cafe-900/15 active:scale-[0.98]'
              }`}
            >
              {added ? (
                <>
                  <Check className="w-5 h-5" /> Added to Cart!
                </>
              ) : (
                <>
                  <ShoppingBag className="w-5 h-5" /> Add to Order • ₹{(item.price * quantity).toFixed(2)}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
