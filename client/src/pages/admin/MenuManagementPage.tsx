import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { MenuCategory, MenuItem } from '../../../shared/types';
import {
  UtensilsCrossed,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Leaf,
  Flame,
  X,
  Loader2,
  FolderPlus,
  ShieldAlert
} from 'lucide-react';

export const MenuManagementPage: React.FC = () => {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Item Modal
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState({
    category_id: 1,
    name: '',
    description: '',
    price: 150,
    image_url: '',
    available: true,
    is_veg: true,
    is_spicy: false
  });
  const [submitting, setSubmitting] = useState(false);

  // Category Modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatOrder, setNewCatOrder] = useState(1);

  const fetchMenuData = async () => {
    setLoading(true);
    try {
      const [catRes, itemRes] = await Promise.all([
        api.get<{ categories: MenuCategory[] }>('/menu/categories'),
        api.get<{ items: MenuItem[] }>('/admin/orders') // we can use public menu endpoint with includeUnavailable or direct query
      ]);
      setCategories(catRes.categories);
      
      // Fetch all items (including unavailable)
      const allItemsRes = await api.get<{ items: MenuItem[] }>('/menu');
      setMenuItems(allItemsRes.items);
    } catch (err) {
      console.error('Failed to fetch menu:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenuData();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormData({
      category_id: categories[0]?.id || 1,
      name: '',
      description: '',
      price: 250,
      image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
      available: true,
      is_veg: true,
      is_spicy: false
    });
    setItemModalOpen(true);
  };

  const handleOpenEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      category_id: item.category_id,
      name: item.name,
      description: item.description,
      price: item.price,
      image_url: item.image_url,
      available: item.available,
      is_veg: !!item.is_veg,
      is_spicy: !!item.is_spicy
    });
    setItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingItem) {
        await api.patch(`/admin/menu/${editingItem.id}`, formData);
      } else {
        await api.post('/admin/menu', formData);
      }
      setItemModalOpen(false);
      await fetchMenuData();
    } catch (err: any) {
      alert(err.data?.error || 'Failed to save menu item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleAvailable = async (item: MenuItem) => {
    try {
      await api.patch(`/admin/menu/${item.id}`, { available: !item.available });
      setMenuItems(prev => prev.map(i => i.id === item.id ? { ...i, available: !item.available } : i));
    } catch (err: any) {
      alert(err.data?.error || 'Failed to update availability');
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this menu item?')) return;
    try {
      await api.delete(`/admin/menu/${id}`);
      await fetchMenuData();
    } catch (err: any) {
      alert(err.data?.error || 'Failed to delete item');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await api.post('/admin/menu/categories', { name: newCatName.trim(), display_order: Number(newCatOrder) });
      setCatModalOpen(false);
      setNewCatName('');
      await fetchMenuData();
    } catch (err: any) {
      alert(err.data?.error || 'Failed to create category');
    }
  };

  const filteredItems = menuItems.filter(item => {
    if (selectedCategory && item.category_id !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-cafe-950">Menu & Category Management</h1>
          <p className="text-xs sm:text-sm text-cafe-600 mt-0.5">
            Configure dishes, categories, live availability and INR pricing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCatModalOpen(true)}
            className="px-3.5 py-2 bg-white border border-cafe-200 rounded-xl text-xs font-semibold text-cafe-800 hover:bg-cafe-50 shadow-xs flex items-center gap-1.5"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Add Category</span>
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-cafe-800 hover:bg-cafe-900 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Dish</span>
          </button>
        </div>
      </div>

      {/* Snapshot immutability notice */}
      <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-2.5 text-xs text-blue-900">
        <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0" />
        <span>
          <strong>Price Immutability Active:</strong> Updating prices here updates future orders immediately while historical orders retain their frozen snapshot prices and item names.
        </span>
      </div>

      {/* Category Pills & Search */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-2xl whitespace-nowrap transition-all shadow-xs ${
              selectedCategory === null
                ? 'bg-cafe-800 text-white shadow-md'
                : 'bg-white text-cafe-700 border border-cafe-200 hover:bg-cafe-50'
            }`}
          >
            All Dishes ({menuItems.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-2xl whitespace-nowrap transition-all shadow-xs ${
                selectedCategory === cat.id
                  ? 'bg-cafe-800 text-white shadow-md'
                  : 'bg-white text-cafe-700 border border-cafe-200 hover:bg-cafe-50'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Search dish by name or description..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-cafe-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cafe-600 placeholder:text-cafe-400"
          />
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-cafe-400 pointer-events-none" />
        </div>
      </div>

      {/* Menu Table / Cards */}
      {loading ? (
        <div className="h-64 bg-white rounded-3xl border border-cafe-200 animate-pulse" />
      ) : (
        <div className="bg-white rounded-3xl border border-cafe-200 shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-cafe-50 text-cafe-600 uppercase font-semibold tracking-wider border-b border-cafe-200">
                  <th className="py-3.5 pl-4">Dish</th>
                  <th className="py-3.5">Category</th>
                  <th className="py-3.5">Price</th>
                  <th className="py-3.5">Dietary</th>
                  <th className="py-3.5">Availability</th>
                  <th className="py-3.5 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cafe-100">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-cafe-50/50 transition-colors">
                    <td className="py-3 pl-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-12 h-12 rounded-xl object-cover border border-cafe-200 shrink-0"
                        />
                        <div className="max-w-xs">
                          <p className="font-bold text-cafe-950 text-sm">{item.name}</p>
                          <p className="text-[11px] text-cafe-500 line-clamp-1">{item.description}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3">
                      <span className="px-2.5 py-0.5 bg-cafe-100 text-cafe-800 rounded-md font-semibold text-[11px]">
                        {item.category_name}
                      </span>
                    </td>

                    <td className="py-3 font-bold text-cafe-900 text-sm">
                      ₹{item.price.toFixed(2)}
                    </td>

                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        {item.is_veg && (
                          <span className="p-1 bg-emerald-100 text-emerald-800 rounded-md" title="Vegetarian">
                            <Leaf className="w-3.5 h-3.5" />
                          </span>
                        )}
                        {item.is_spicy && (
                          <span className="p-1 bg-red-100 text-red-800 rounded-md" title="Spicy">
                            <Flame className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3">
                      <button
                        onClick={() => handleToggleAvailable(item)}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                          item.available
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                      >
                        {item.available ? 'In Stock' : 'Out of Stock'}
                      </button>
                    </td>

                    <td className="py-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="p-2 text-cafe-600 hover:text-cafe-950 hover:bg-cafe-100 rounded-lg transition-colors"
                          title="Edit Dish"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-2 text-cafe-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Dish"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Dish Modal */}
      {itemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg overflow-hidden bg-white rounded-3xl shadow-2xl border border-cafe-200 p-6 text-left space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-2 border-b border-cafe-100">
              <h3 className="text-lg font-serif font-bold text-cafe-950">
                {editingItem ? 'Edit Dish' : 'Add New Menu Item'}
              </h3>
              <button
                onClick={() => setItemModalOpen(false)}
                className="p-1 text-cafe-400 hover:text-cafe-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-cafe-800 mb-1">Category</label>
                  <select
                    value={formData.category_id}
                    onChange={e => setFormData({ ...formData, category_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-cafe-50 border border-cafe-200 rounded-xl text-xs font-semibold text-cafe-900 focus:ring-2 focus:ring-cafe-600"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-cafe-800 mb-1">Price (₹ INR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-cafe-50 border border-cafe-200 rounded-xl text-xs font-bold text-cafe-900 focus:ring-2 focus:ring-cafe-600"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-cafe-800 mb-1">Dish Name</label>
                <input
                  type="text"
                  placeholder="e.g. Truffle Mushroom Risotto"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-cafe-50 border border-cafe-200 rounded-xl text-xs font-semibold text-cafe-900 focus:ring-2 focus:ring-cafe-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-cafe-800 mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Appetizing description of ingredients, style and taste..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-cafe-50 border border-cafe-200 rounded-xl text-xs text-cafe-900 focus:ring-2 focus:ring-cafe-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-cafe-800 mb-1">Image URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={formData.image_url}
                  onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                  className="w-full px-3 py-2 bg-cafe-50 border border-cafe-200 rounded-xl text-xs text-cafe-900 focus:ring-2 focus:ring-cafe-600"
                  required
                />
              </div>

              <div className="flex items-center gap-4 pt-1 text-xs font-semibold text-cafe-800">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_veg}
                    onChange={e => setFormData({ ...formData, is_veg: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>100% Vegetarian</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_spicy}
                    onChange={e => setFormData({ ...formData, is_spicy: e.target.checked })}
                    className="rounded text-red-600 focus:ring-red-500"
                  />
                  <span>Spicy Dish</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.available}
                    onChange={e => setFormData({ ...formData, available: e.target.checked })}
                    className="rounded text-cafe-800 focus:ring-cafe-500"
                  />
                  <span>In Stock</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-cafe-800 hover:bg-cafe-900 disabled:opacity-50 text-white font-bold rounded-xl shadow text-xs flex items-center justify-center gap-1.5"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : editingItem ? 'Save Changes' : 'Add Dish to Menu'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {catModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-sm overflow-hidden bg-white rounded-3xl shadow-2xl border border-cafe-200 p-6 text-left space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-2 border-b border-cafe-100">
              <h3 className="text-base font-serif font-bold text-cafe-950">Add Menu Category</h3>
              <button
                onClick={() => setCatModalOpen(false)}
                className="p-1 text-cafe-400 hover:text-cafe-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-cafe-800 mb-1">Category Name</label>
                <input
                  type="text"
                  placeholder="e.g. Artisanal Breads, Smoothies"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  className="w-full px-3 py-2 bg-cafe-50 border border-cafe-200 rounded-xl text-xs font-semibold text-cafe-900 focus:ring-2 focus:ring-cafe-600"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-cafe-800 mb-1">Display Order</label>
                <input
                  type="number"
                  value={newCatOrder}
                  onChange={e => setNewCatOrder(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-cafe-50 border border-cafe-200 rounded-xl text-xs font-semibold text-cafe-900 focus:ring-2 focus:ring-cafe-600"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-cafe-800 hover:bg-cafe-900 text-white font-bold rounded-xl shadow text-xs"
              >
                Create Category
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
