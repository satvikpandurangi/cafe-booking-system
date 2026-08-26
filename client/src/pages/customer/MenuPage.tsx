import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { MenuCategory, MenuItem } from '../../../shared/types';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useTable } from '../../context/TableContext';
import { DishDetailModal } from '../../components/customer/DishDetailModal';
import { CartDrawer } from '../../components/customer/CartDrawer';
import { AuthModal } from '../../components/customer/AuthModal';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ShoppingBag,
  Leaf,
  Flame,
  Plus,
  Minus,
  Coffee,
  User as UserIcon,
  ShieldCheck,
  QrCode,
  Clock,
  ChevronRight,
  Filter
} from 'lucide-react';

export const MenuPage: React.FC = () => {
  const { items: cartItems, itemCount, total, addItem, updateQuantity, openCart } = useCart();
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const { hasTableSession, tableVerifiedMessage } = useTable();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [spicyOnly, setSpicyOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDish, setSelectedDish] = useState<MenuItem | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [catRes, menuRes] = await Promise.all([
          api.get<{ categories: MenuCategory[] }>('/menu/categories'),
          api.get<{ items: MenuItem[] }>('/menu')
        ]);
        setCategories(catRes.categories);
        setMenuItems(menuRes.items);
      } catch (err) {
        console.error('Failed to load menu data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filter items
  const filteredItems = menuItems.filter(item => {
    if (selectedCategory && item.category_id !== selectedCategory) return false;
    if (vegOnly && !item.is_veg) return false;
    if (spicyOnly && !item.is_spicy) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.category_name && item.category_name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-cafe-50 text-espresso-800 pb-28">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-cafe-900/95 backdrop-blur-md text-cafe-50 border-b border-cafe-800 px-4 py-3 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/menu')}>
            <div className="w-10 h-10 rounded-xl bg-cafe-800 border border-cafe-700 flex items-center justify-center text-amber-300 shadow-inner">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-serif font-bold text-base sm:text-lg text-white leading-tight">
                Artisan Bistro
              </h1>
              <div className="flex items-center gap-1.5 text-[11px] text-cafe-300">
                {hasTableSession ? (
                  <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" /> Table Verified
                  </span>
                ) : (
                  <button
                    onClick={() => navigate('/entry')}
                    className="flex items-center gap-1 text-amber-300 underline hover:text-amber-200"
                  >
                    <QrCode className="w-3 h-3" /> Scan Table QR
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <button
                onClick={() => navigate('/orders')}
                className="flex items-center gap-1.5 px-3 py-2 bg-cafe-800 hover:bg-cafe-700 border border-cafe-700 rounded-xl text-xs font-semibold text-cafe-100 transition-all"
                title="My Orders & Profile"
              >
                <Clock className="w-4 h-4 text-cafe-300" />
                <span className="hidden sm:inline">My Orders</span>
              </button>
            ) : (
              <button
                onClick={openAuthModal}
                className="flex items-center gap-1.5 px-3 py-2 bg-cafe-800 hover:bg-cafe-700 border border-cafe-700 rounded-xl text-xs font-semibold text-cafe-100 transition-all"
              >
                <UserIcon className="w-4 h-4 text-cafe-300" />
                <span>Login</span>
              </button>
            )}

            <button
              onClick={openCart}
              className="relative p-2.5 bg-cafe-700 hover:bg-cafe-600 text-white rounded-xl transition-all flex items-center justify-center shadow-md"
              title="Cart"
            >
              <ShoppingBag className="w-5 h-5 text-amber-200" />
              {itemCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-emerald-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center shadow-md animate-scaleUp">
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 pt-4 space-y-4">
        
        {/* Table Session Alert if not active */}
        {!hasTableSession && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between text-xs text-amber-900 shadow-sm animate-fadeIn">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-amber-700 shrink-0" />
              <span>Ordering is enabled once your table QR is scanned.</span>
            </div>
            <button
              onClick={() => navigate('/entry')}
              className="px-3 py-1.5 bg-amber-800 hover:bg-amber-900 text-white font-semibold rounded-xl text-xs shrink-0 flex items-center gap-1"
            >
              Scan Table <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search our handcrafted coffees, pastas, pizzas & desserts..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-cafe-200 rounded-2xl text-sm text-espresso-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-cafe-500 focus:border-transparent placeholder:text-cafe-400"
          />
          <Search className="absolute left-3.5 top-3.5 w-5 h-5 text-cafe-400 pointer-events-none" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-3 text-xs text-cafe-400 hover:text-cafe-700 bg-cafe-100 px-2 py-0.5 rounded-full"
            >
              Clear
            </button>
          )}
        </div>

        {/* Category Pills and Dietary Filters */}
        <div className="space-y-2.5">
          {/* Horizontal scroll categories */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs font-semibold">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-2xl whitespace-nowrap transition-all shadow-xs ${
                selectedCategory === null
                  ? 'bg-cafe-800 text-white shadow-md shadow-cafe-900/10'
                  : 'bg-white text-cafe-700 border border-cafe-200 hover:bg-cafe-100'
              }`}
            >
              All Items ({menuItems.length})
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-2xl whitespace-nowrap transition-all shadow-xs ${
                  selectedCategory === cat.id
                    ? 'bg-cafe-800 text-white shadow-md shadow-cafe-900/10'
                    : 'bg-white text-cafe-700 border border-cafe-200 hover:bg-cafe-100'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Quick Dietary Filters */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setVegOnly(!vegOnly)}
              className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all ${
                vegOnly
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold'
                  : 'bg-white border-cafe-200 text-cafe-600 hover:bg-cafe-50'
              }`}
            >
              <Leaf className={`w-3.5 h-3.5 ${vegOnly ? 'text-emerald-600' : 'text-cafe-400'}`} />
              <span>Veg Only</span>
            </button>

            <button
              onClick={() => setSpicyOnly(!spicyOnly)}
              className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all ${
                spicyOnly
                  ? 'bg-red-50 border-red-500 text-red-800 font-bold'
                  : 'bg-white border-cafe-200 text-cafe-600 hover:bg-cafe-50'
              }`}
            >
              <Flame className={`w-3.5 h-3.5 ${spicyOnly ? 'text-red-600' : 'text-cafe-400'}`} />
              <span>Spicy</span>
            </button>

            {(vegOnly || spicyOnly || searchQuery || selectedCategory !== null) && (
              <button
                onClick={() => {
                  setVegOnly(false);
                  setSpicyOnly(false);
                  setSearchQuery('');
                  setSelectedCategory(null);
                }}
                className="text-[11px] text-cafe-600 underline ml-auto"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>

        {/* Menu Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-white rounded-3xl border border-cafe-200 animate-pulse p-4 flex flex-col justify-between">
                <div className="h-32 bg-cafe-100 rounded-2xl mb-3" />
                <div className="h-4 bg-cafe-100 rounded w-3/4 mb-2" />
                <div className="h-3 bg-cafe-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-cafe-200 my-6">
            <Filter className="w-10 h-10 text-cafe-300 mx-auto mb-3" />
            <h3 className="text-lg font-serif font-bold text-cafe-900 mb-1">No matching dishes found</h3>
            <p className="text-xs text-cafe-600 mb-4">Try clearing your filters or searching for something else.</p>
            <button
              onClick={() => {
                setVegOnly(false);
                setSpicyOnly(false);
                setSearchQuery('');
                setSelectedCategory(null);
              }}
              className="px-4 py-2 bg-cafe-800 text-white rounded-xl text-xs font-semibold"
            >
              Show All Dishes
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {filteredItems.map(item => {
              const inCart = cartItems.find(i => i.menuItem.id === item.id);
              const qty = inCart ? inCart.quantity : 0;

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-3xl border border-cafe-200/80 shadow-soft hover:shadow-card transition-all overflow-hidden flex flex-col justify-between group"
                >
                  {/* Dish Image + Badges */}
                  <div
                    className="relative h-44 sm:h-48 w-full bg-cafe-100 overflow-hidden cursor-pointer"
                    onClick={() => setSelectedDish(item)}
                  >
                    <img
                      src={item.image_url}
                      alt={item.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

                    <div className="absolute top-3 left-3 flex gap-1.5">
                      {item.is_veg && (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-600 text-white rounded-full flex items-center gap-1 shadow">
                          <Leaf className="w-3 h-3" /> Veg
                        </span>
                      )}
                      {item.is_spicy && (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-red-600 text-white rounded-full flex items-center gap-1 shadow">
                          <Flame className="w-3 h-3" /> Spicy
                        </span>
                      )}
                    </div>

                    <div className="absolute bottom-3 left-3">
                      <span className="text-xs font-semibold px-2 py-0.5 bg-black/60 backdrop-blur-md text-cafe-100 rounded-lg">
                        {item.category_name}
                      </span>
                    </div>
                  </div>

                  {/* Body Info */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div
                      className="cursor-pointer"
                      onClick={() => setSelectedDish(item)}
                    >
                      <h3 className="font-serif font-bold text-base text-cafe-950 line-clamp-1 group-hover:text-cafe-700 transition-colors">
                        {item.name}
                      </h3>
                      <p className="text-xs text-cafe-600 line-clamp-2 mt-1 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    {/* Price and Cart Stepper */}
                    <div className="pt-3 mt-3 border-t border-cafe-100 flex items-center justify-between">
                      <span className="text-base font-bold text-cafe-900">
                        ₹{item.price.toFixed(2)}
                      </span>

                      {qty > 0 ? (
                        <div className="flex items-center gap-2 bg-cafe-50 border border-cafe-200 p-1 rounded-xl shadow-xs">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              updateQuantity(item.id, qty - 1);
                            }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-cafe-900 shadow-xs hover:bg-cafe-100 active:scale-95 transition-all"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-4 text-center font-bold text-xs text-cafe-900">
                            {qty}
                          </span>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              updateQuantity(item.id, qty + 1);
                            }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-cafe-900 shadow-xs hover:bg-cafe-100 active:scale-95 transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            addItem(item, 1);
                          }}
                          className="py-1.5 px-3.5 bg-cafe-800 hover:bg-cafe-900 text-white text-xs font-semibold rounded-xl shadow-sm hover:shadow active:scale-95 transition-all flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Sticky Cart Bar for Mobile/Desktop */}
      {itemCount > 0 && (
        <div className="fixed bottom-4 inset-x-4 max-w-lg mx-auto z-40 animate-slideUp">
          <div
            onClick={openCart}
            className="p-3.5 bg-cafe-900 text-white rounded-3xl shadow-2xl border border-cafe-700 flex items-center justify-between cursor-pointer hover:bg-cafe-950 transition-all"
          >
            <div className="flex items-center gap-3 pl-1">
              <div className="w-10 h-10 rounded-2xl bg-amber-400 text-cafe-950 font-bold flex items-center justify-center text-sm shadow">
                {itemCount}
              </div>
              <div>
                <p className="text-xs text-cafe-300">View Table Order</p>
                <p className="text-base font-bold text-white leading-tight">₹{total.toFixed(2)}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 pr-2 text-xs font-bold text-amber-300">
              <span>Checkout</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      )}

      {/* Modals and Drawers */}
      <DishDetailModal
        item={selectedDish}
        onClose={() => setSelectedDish(null)}
      />
      <CartDrawer />
      <AuthModal />
    </div>
  );
};
