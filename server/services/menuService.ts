import { db } from '../db/database';
import { MenuCategory, MenuItem } from '../../shared/types';

type MenuItemDbRow = Omit<MenuItem, 'available' | 'is_veg' | 'is_spicy'> & {
  available: number;
  is_veg: number;
  is_spicy: number;
};

export class MenuService {
  /**
   * Public: Get all active categories with their display order.
   */
  static async getCategories(): Promise<MenuCategory[]> {
    return await db.all<MenuCategory>(`
      SELECT id, name, display_order, created_at, updated_at
      FROM menu_categories
      ORDER BY display_order ASC, name ASC
    `);
  }

  /**
   * Public: Get menu items for customers (only available items unless requested for admin preview).
   * Supports search query and category filtering.
   */
  static async getMenuItems(options?: {
    categoryId?: number;
    search?: string;
    includeUnavailable?: boolean;
  }): Promise<MenuItem[]> {
    let sql = `
      SELECT 
        m.id,
        m.category_id,
        c.name as category_name,
        m.name,
        m.description,
        m.price,
        m.image_url,
        m.available,
        m.is_veg,
        m.is_spicy,
        m.created_at,
        m.updated_at
      FROM menu_items m
      JOIN menu_categories c ON c.id = m.category_id
      WHERE 1=1
    `;

    const params: (string | number)[] = [];

    if (!options?.includeUnavailable) {
      sql += ' AND m.available = 1';
    }

    if (options?.categoryId) {
      sql += ' AND m.category_id = ?';
      params.push(options.categoryId);
    }

    if (options?.search && options.search.trim()) {
      sql += ' AND (m.name LIKE ? OR m.description LIKE ?)';
      const term = `%${options.search.trim()}%`;
      params.push(term, term);
    }

    sql += ' ORDER BY c.display_order ASC, m.name ASC';

    const rows = await db.all<MenuItemDbRow>(sql, params);

    return rows.map(r => ({
      id: r.id,
      category_id: r.category_id,
      category_name: r.category_name,
      name: r.name,
      description: r.description,
      price: r.price,
      image_url: r.image_url,
      created_at: r.created_at,
      updated_at: r.updated_at,
      available: Boolean(r.available),
      is_veg: Boolean(r.is_veg),
      is_spicy: Boolean(r.is_spicy)
    }));
  }

  /**
   * Public: Get single menu item detail by ID.
   */
  static async getMenuItemById(id: number): Promise<MenuItem | null> {
    const row = await db.get<MenuItemDbRow>(`
      SELECT 
        m.id,
        m.category_id,
        c.name as category_name,
        m.name,
        m.description,
        m.price,
        m.image_url,
        m.available,
        m.is_veg,
        m.is_spicy,
        m.created_at,
        m.updated_at
      FROM menu_items m
      JOIN menu_categories c ON c.id = m.category_id
      WHERE m.id = ?
    `, [id]);

    if (!row) return null;

    return {
      id: row.id,
      category_id: row.category_id,
      category_name: row.category_name,
      name: row.name,
      description: row.description,
      price: row.price,
      image_url: row.image_url,
      created_at: row.created_at,
      updated_at: row.updated_at,
      available: Boolean(row.available),
      is_veg: Boolean(row.is_veg),
      is_spicy: Boolean(row.is_spicy)
    };
  }

  /**
   * Admin: Create a new category.
   */
  static async createCategory(name: string, displayOrder: number = 0): Promise<MenuCategory> {
    const result = await db.run(
      'INSERT INTO menu_categories (name, display_order) VALUES (?, ?)',
      [name.trim(), displayOrder]
    );

    return (await db.get<MenuCategory>('SELECT * FROM menu_categories WHERE id = ?', [result.lastInsertRowid]))!;
  }

  /**
   * Admin: Update category.
   */
  static async updateCategory(id: number, name: string, displayOrder: number): Promise<boolean> {
    const result = await db.run(`
      UPDATE menu_categories 
      SET name = ?, display_order = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name.trim(), displayOrder, id]);

    return result.changes > 0;
  }

  /**
   * Admin: Delete category.
   */
  static async deleteCategory(id: number): Promise<{ success: boolean; message?: string }> {
    const itemCount = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM menu_items WHERE category_id = ?', [id]);
    if (itemCount && itemCount.count > 0) {
      return { success: false, message: `Cannot delete category with ${itemCount.count} existing menu items. Reassign or delete items first.` };
    }

    const result = await db.run('DELETE FROM menu_categories WHERE id = ?', [id]);
    return { success: result.changes > 0 };
  }

  /**
   * Admin: Create menu item.
   */
  static async createMenuItem(data: {
    category_id: number;
    name: string;
    description: string;
    price: number;
    image_url: string;
    available?: boolean;
    is_veg?: boolean;
    is_spicy?: boolean;
  }): Promise<MenuItem> {
    const result = await db.run(`
      INSERT INTO menu_items (category_id, name, description, price, image_url, available, is_veg, is_spicy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.category_id,
      data.name.trim(),
      data.description.trim(),
      Number(data.price),
      data.image_url.trim(),
      data.available !== false ? 1 : 0,
      data.is_veg !== false ? 1 : 0,
      data.is_spicy ? 1 : 0
    ]);

    const created = await this.getMenuItemById(Number(result.lastInsertRowid));
    return created!;
  }

  /**
   * Admin: Update menu item.
   */
  static async updateMenuItem(id: number, data: {
    category_id?: number;
    name?: string;
    description?: string;
    price?: number;
    image_url?: string;
    available?: boolean;
    is_veg?: boolean;
    is_spicy?: boolean;
  }): Promise<MenuItem | null> {
    const current = await this.getMenuItemById(id);
    if (!current) return null;

    await db.run(`
      UPDATE menu_items 
      SET category_id = COALESCE(?, category_id),
          name = COALESCE(?, name),
          description = COALESCE(?, description),
          price = COALESCE(?, price),
          image_url = COALESCE(?, image_url),
          available = COALESCE(?, available),
          is_veg = COALESCE(?, is_veg),
          is_spicy = COALESCE(?, is_spicy),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      data.category_id ?? null,
      data.name?.trim() ?? null,
      data.description?.trim() ?? null,
      data.price !== undefined ? Number(data.price) : null,
      data.image_url?.trim() ?? null,
      data.available !== undefined ? (data.available ? 1 : 0) : null,
      data.is_veg !== undefined ? (data.is_veg ? 1 : 0) : null,
      data.is_spicy !== undefined ? (data.is_spicy ? 1 : 0) : null,
      id
    ]);

    return await this.getMenuItemById(id);
  }

  /**
   * Admin: Delete menu item.
   */
  static async deleteMenuItem(id: number): Promise<boolean> {
    const result = await db.run('DELETE FROM menu_items WHERE id = ?', [id]);
    return result.changes > 0;
  }
}
