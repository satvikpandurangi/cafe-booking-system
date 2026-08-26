import { Router, Request, Response } from 'express';
import { MenuService } from '../services/menuService';

const router = Router();

/**
 * GET /api/menu/categories
 */
router.get('/categories', async (req: Request, res: Response) => {
  const categories = await MenuService.getCategories();
  return res.json({ categories });
});

/**
 * GET /api/menu
 * Optional query params: categoryId (number), search (string)
 */
router.get('/', async (req: Request, res: Response) => {
  const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;

  const items = await MenuService.getMenuItems({
    categoryId,
    search,
    includeUnavailable: false
  });

  return res.json({ items });
});

/**
 * GET /api/menu/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid menu item ID' });
  }

  const item = await MenuService.getMenuItemById(id);
  if (!item) {
    return res.status(404).json({ error: 'Menu item not found' });
  }

  return res.json({ item });
});

export default router;
