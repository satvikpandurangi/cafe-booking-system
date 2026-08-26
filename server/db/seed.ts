import { db, initDatabase } from './database';
import { hashPassword, hashToken, generateOpaqueToken } from '../utils/crypto';
import fs from 'fs';
import path from 'path';

export async function seedDatabase(): Promise<{ initialTokens: Record<string, string>; tableIds: number[] }> {
  console.log('--- Seeding Cafe Booking & Ordering Database ---');
  await initDatabase();

  // Clean existing data
  const clearTables = [
    'order_items', 'payments', 'orders', 'table_sessions',
    'otp_records', 'menu_items', 'menu_categories', 'tables', 'admin_users', 'users', 'idempotency_keys'
  ];
  
  for (const table of clearTables) {
    await db.run(`DELETE FROM ${table}`);
  }

  // Reset sqlite auto-increment sequence if exists
  try {
    await db.run("DELETE FROM sqlite_sequence WHERE name IN ('tables', 'menu_items', 'menu_categories', 'users', 'orders', 'order_items', 'payments', 'admin_users')");
  } catch (err) {
    // sqlite_sequence might not exist
  }

  // 1. Seed Admin Users
  const adminPasswordHash = await hashPassword('Admin@12345');
  const staffPasswordHash = await hashPassword('Staff@12345');

  await db.run(
    'INSERT INTO admin_users (email, password_hash, role) VALUES (?, ?, ?)',
    ['admin@cafe.local', adminPasswordHash, 'ADMIN']
  );
  await db.run(
    'INSERT INTO admin_users (email, password_hash, role) VALUES (?, ?, ?)',
    ['staff@cafe.local', staffPasswordHash, 'STAFF']
  );
  console.log('Seeded admin & staff accounts.');

  // 2. Seed 10 Physical Tables with Secure Opaque Tokens
  const initialTokens: Record<string, string> = {};
  const tableIds: number[] = [];

  for (let i = 1; i <= 10; i++) {
    const tableCode = `T-${i < 10 ? '0' + i : i}`;
    const rawToken = generateOpaqueToken();
    const tokenHash = hashToken(rawToken);
    
    let status = 'AVAILABLE';
    if (i === 4) status = 'OCCUPIED';
    if (i === 5) status = 'ORDER_PENDING';
    if (i === 6) status = 'CLEANING';

    const tRes = await db.run(
      'INSERT INTO tables (internal_table_code, secure_token_hash, status) VALUES (?, ?, ?)',
      [tableCode, tokenHash, status]
    );
    tableIds.push(Number(tRes.lastInsertRowid));
    initialTokens[tableCode] = rawToken;
  }
  console.log('Seeded 10 tables with cryptographic opaque tokens.');

  // Save tokens to local dev reference file (never used by frontend client directly)
  try {
    const devTokenFilePath = path.resolve(process.cwd(), 'data', 'dev_table_tokens.json');
    const devTokenDir = path.dirname(devTokenFilePath);
    if (!fs.existsSync(devTokenDir)) {
      fs.mkdirSync(devTokenDir, { recursive: true });
    }
    fs.writeFileSync(devTokenFilePath, JSON.stringify(initialTokens, null, 2));
    console.log(`Saved dev table token reference to: ${devTokenFilePath}`);
  } catch (e) {
    // Filesystem may be read-only in some environments
  }

  // 3. Seed Menu Categories
  const categories = [
    { name: 'Starters', display_order: 1 },
    { name: 'Main Course', display_order: 2 },
    { name: 'Snacks', display_order: 3 },
    { name: 'Beverages', display_order: 4 },
    { name: 'Desserts', display_order: 5 }
  ];

  const categoryMap = new Map<string, number>();
  for (const cat of categories) {
    const result = await db.run(
      'INSERT INTO menu_categories (name, display_order) VALUES (?, ?)',
      [cat.name, cat.display_order]
    );
    categoryMap.set(cat.name, Number(result.lastInsertRowid));
  }
  console.log('Seeded 5 menu categories.');

  // 4. Seed Menu Items
  const menuItems = [
    // Starters
    {
      category: 'Starters',
      name: 'Artisan Garlic Bruschetta',
      description: 'Toasted sourdough rubbed with garlic, topped with vine-ripened tomatoes, fresh basil, and balsamic glaze.',
      price: 240.00,
      image_url: 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=600&auto=format&fit=crop&q=80',
      is_veg: 1,
      is_spicy: 0
    },
    {
      category: 'Starters',
      name: 'Crispy Peri Peri French Fries',
      description: 'Golden hand-cut potato fries tossed in fiery African peri-peri spices with cheesy herb dip.',
      price: 190.00,
      image_url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=80',
      is_veg: 1,
      is_spicy: 1
    },
    {
      category: 'Starters',
      name: 'Paneer Tikka Crostini',
      description: 'Char-grilled cottage cheese cubes seasoned with tandoori marinade on mini herb crostini.',
      price: 290.00,
      image_url: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&auto=format&fit=crop&q=80',
      is_veg: 1,
      is_spicy: 1
    },
    {
      category: 'Starters',
      name: 'Loaded Nachos Grande',
      description: 'Crisp tortilla chips baked with spiced refried beans, cheddar cheese sauce, salsa, and jalapenos.',
      price: 320.00,
      image_url: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=600&auto=format&fit=crop&q=80',
      is_veg: 1,
      is_spicy: 0
    },
    {
      category: 'Starters',
      name: 'Smoked Jalapeno Poppers',
      description: 'Crispy crumb-coated jalapeno peppers filled with molten mozzarella and cream cheese.',
      price: 260.00,
      image_url: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=600&auto=format&fit=crop&q=80',
      is_veg: 1,
      is_spicy: 1
    },

    // Main Course
    {
      category: 'Main Course',
      name: 'Creamy Alfredo Fettuccine',
      description: 'Handcrafted pasta ribbons tossed in a rich garlic parmesan cream sauce with wild mushrooms and herbs.',
      price: 380.00,
      image_url: 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=600&auto=format&fit=crop&q=80',
      is_veg: 1,
      is_spicy: 0
    },
    {
      category: 'Main Course',
      name: 'Classic Margherita Wood-Fired Pizza',
      description: 'Neapolitan style thin crust with San Marzano tomato sauce, fresh buffalo mozzarella, and sweet basil leaves.',
      price: 420.00,
      image_url: 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=600&auto=format&fit=crop&q=80',
      is_veg: 1,
      is_spicy: 0
    },
    {
      category: 'Main Course',
      name: 'Farmhouse Gourmet Pizza',
      description: 'Loaded with bell peppers, sweet corn, black olives, red onions, mushrooms, and mozzarella cheese.',
      price: 460.00,
      image_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80',
      is_veg: 1,
      is_spicy: 0
    },
    {
      category: 'Main Course',
      name: 'Penne Arbiatta Piccante',
      description: 'Al dente penne pasta in a spicy tomato concasse sauce with crushed chili flakes, garlic, and fresh basil.',
      price: 360.00,
      image_url: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281290?w=600&auto=format&fit=crop&q=80',
      is_veg: 1,
      is_spicy: 1
    },
    {
      category: 'Main Course',
      name: 'Mediterranean Risotto',
      description: 'Arborio rice slowly cooked in vegetable broth with sun-dried tomatoes, asparagus, and aged parmesan.',
      price: 410.00,
      image_url: 'https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?w=600&auto=format&fit=crop&q=80',
      is_veg: 1,
      is_spicy: 0
    },

    // Snacks & Sandwiches
    {
      category: 'Snacks',
      name: 'Gourmet Truffle Mushroom Burger',
      description: 'Grilled portobello mushroom patty with caramelized onions, truffle aioli, and swiss cheese on brioche.',
      price: 340.00,
      image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80',
      is_veg: 1,
      is_spicy: 0
    },
    {
      category: 'Snacks',
      name: 'Spicy Paneer Tikka Panini',
      description: 'Pressed artisan ciabatta bread stuffed with tandoori paneer, mint chutney, and molten mozzarella.',
      price: 280.00,
      image_url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&auto=format&fit=crop&q=80',
      is_veg: 1,
      is_spicy: 1
    },
    {
      category: 'Snacks',
      name: 'Avocado & Tomato Toast',
      description: 'Smashed Haas avocado, cherry tomatoes, microgreens, and pumpkin seeds on toasted multigrain sourdough.',
      price: 310.00,
      image_url: 'https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?w=600&auto=format&fit=crop&q=80',
      is_veg: 1,
      is_spicy: 0
    },
    {
      category: 'Snacks',
      name: 'Crispy Veg Spring Rolls',
      description: 'Golden rolls stuffed with julienned vegetables and glass noodles, served with sweet chili sauce.',
      price: 220.00,
      image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80',
      is_veg: 1,
      is_spicy: 0
    },

    // Beverages
    {
      category: 'Beverages',
      name: 'Single Origin Espresso Double',
      description: 'Rich, full-bodied double shot extracted from 100% Arabica roasted beans with thick golden crema.',
      price: 150.00,
      image_url: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=600&auto=format&fit=crop&q=80',
      is_veg: 1,
      is_spicy: 0
    },
    {
      category: 'Beverages',
      name: 'Velvet Cappuccino',
      description: 'Espresso topped with steamed milk and a velvety dense layer of micro-foam dusted with cocoa powder.',
      price: 210.00,
      image_url: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=600&auto=format&fit=crop&q=80',
      is_veg: 1,
      is_spicy: 0
    },
    {
      category: 'Beverages',
      name: 'Hazelnut Iced Latte',
      description: 'Chilled espresso combined with fresh milk, roasted hazelnut syrup, and poured over crystal ice cubes.',
      price: 240.00,
      image_url: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=600&auto=format&fit=crop&q=80',
      is_veg: 1,
      is_spicy: 0
    },
    {
      category: 'Beverages',
      name: 'Belgian Hot Chocolate',
      description: 'Melted Belgian dark chocolate whisked with hot whole milk and topped with fluffy marshmallows.',
      price: 250.00,
      image_url: 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=600&auto=format&fit=crop&q=80',
      is_veg: 1,
      is_spicy: 0
    },
    {
      category: 'Beverages',
      name: 'Passion Fruit & Mint Cooler',
      description: 'Refreshing sparkling cooler infused with real passion fruit pulp, crushed garden mint, and lime juice.',
      price: 220.00,
      image_url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80',
      is_veg: 1,
      is_spicy: 0
    },
    {
      category: 'Beverages',
      name: 'Classic Cold Brew Coffee',
      description: 'Coarsely ground beans steeped in cold mountain water for 18 hours for smooth, low-acid coffee taste.',
      price: 230.00,
      image_url: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600&auto=format&fit=crop&q=80',
      is_veg: 1,
      is_spicy: 0
    },

    // Desserts
    {
      category: 'Desserts',
      name: 'Molten Belgian Chocolate Lava Cake',
      description: 'Warm chocolate cake with a rich flowing chocolate center, served with a scoop of Madagascar vanilla gelato.',
      price: 290.00,
      image_url: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&auto=format&fit=crop&q=80',
      is_veg: 1,
      is_spicy: 0
    },
    {
      category: 'Desserts',
      name: 'Classic Italian Tiramisu',
      description: 'Savoiardi ladyfingers dipped in strong espresso and layered with mascarpone cream and cocoa powder.',
      price: 320.00,
      image_url: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&auto=format&fit=crop&q=80',
      is_veg: 1,
      is_spicy: 0
    },
    {
      category: 'Desserts',
      name: 'New York Baked Cheesecake',
      description: 'Dense, smooth cream cheese filling on a buttery graham cracker crust with raspberry coulis.',
      price: 310.00,
      image_url: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=600&auto=format&fit=crop&q=80',
      is_veg: 1,
      is_spicy: 0
    },
    {
      category: 'Desserts',
      name: 'Warm Apple Cinnamon Crumble',
      description: 'Caramelized apples baked with warm cinnamon spice and topped with a crunchy golden oat crumble.',
      price: 270.00,
      image_url: 'https://images.unsplash.com/photo-1568571780765-9276ac8b75a2?w=600&auto=format&fit=crop&q=80',
      is_veg: 1,
      is_spicy: 0
    }
  ];

  const insertedMenuItemIds: number[] = [];
  for (const item of menuItems) {
    const categoryId = categoryMap.get(item.category);
    if (categoryId) {
      const mRes = await db.run(
        'INSERT INTO menu_items (category_id, name, description, price, image_url, available, is_veg, is_spicy) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
        [categoryId, item.name, item.description, item.price, item.image_url, item.is_veg, item.is_spicy]
      );
      insertedMenuItemIds.push(Number(mRes.lastInsertRowid));
    }
  }
  console.log(`Seeded ${menuItems.length} menu items.`);

  // 5. Seed Demo Users
  const user1 = await db.run('INSERT INTO users (phone) VALUES (?)', ['+919876543210']);
  const user2 = await db.run('INSERT INTO users (phone) VALUES (?)', ['+919123456789']);
  const user3 = await db.run('INSERT INTO users (phone) VALUES (?)', ['+919898989898']);
  console.log('Seeded demo users.');

  // 6. Seed Sample Orders with Realistic Statuses
  // Sample Order 1: Completed UPI order
  const order1Result = await db.run(
    "INSERT INTO orders (public_order_number, user_id, table_id, subtotal, tax, total, payment_method, payment_status, order_status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))",
    ['ORD-582914', Number(user1.lastInsertRowid), tableIds[0], 620.00, 31.00, 651.00, 'UPI', 'PAID', 'COMPLETED', 'Extra spicy fries please', '-2 hours']
  );
  const order1Id = Number(order1Result.lastInsertRowid);
  await db.run(
    'INSERT INTO order_items (order_id, menu_item_id, item_name_snapshot, unit_price_snapshot, quantity, total) VALUES (?, ?, ?, ?, ?, ?)',
    [order1Id, insertedMenuItemIds[0], 'Artisan Garlic Bruschetta', 240.00, 1, 240.00]
  );
  await db.run(
    'INSERT INTO order_items (order_id, menu_item_id, item_name_snapshot, unit_price_snapshot, quantity, total) VALUES (?, ?, ?, ?, ?, ?)',
    [order1Id, insertedMenuItemIds[5], 'Creamy Alfredo Fettuccine', 380.00, 1, 380.00]
  );
  await db.run(
    "INSERT INTO payments (order_id, method, amount, status, transaction_reference, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', ?))",
    [order1Id, 'UPI', 651.00, 'PAID', 'UPI-REF-9928374182', '-2 hours']
  );

  // Sample Order 2: Preparing Cash order (Payment Pending at counter)
  const order2Result = await db.run(
    "INSERT INTO orders (public_order_number, user_id, table_id, subtotal, tax, total, payment_method, payment_status, order_status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))",
    ['ORD-918234', Number(user2.lastInsertRowid), tableIds[1], 530.00, 26.50, 556.50, 'CASH', 'PENDING', 'PREPARING', 'Serve dessert after pasta', '-25 minutes']
  );
  const order2Id = Number(order2Result.lastInsertRowid);
  await db.run(
    'INSERT INTO order_items (order_id, menu_item_id, item_name_snapshot, unit_price_snapshot, quantity, total) VALUES (?, ?, ?, ?, ?, ?)',
    [order2Id, insertedMenuItemIds[16], 'Hazelnut Iced Latte', 240.00, 1, 240.00]
  );
  await db.run(
    'INSERT INTO order_items (order_id, menu_item_id, item_name_snapshot, unit_price_snapshot, quantity, total) VALUES (?, ?, ?, ?, ?, ?)',
    [order2Id, insertedMenuItemIds[20], 'Molten Belgian Chocolate Lava Cake', 290.00, 1, 290.00]
  );
  await db.run(
    "INSERT INTO payments (order_id, method, amount, status, transaction_reference, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', ?))",
    [order2Id, 'CASH', 556.50, 'PENDING', null, '-25 minutes']
  );

  // Sample Order 3: Pending UPI order
  const order3Result = await db.run(
    "INSERT INTO orders (public_order_number, user_id, table_id, subtotal, tax, total, payment_method, payment_status, order_status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))",
    ['ORD-204918', Number(user3.lastInsertRowid), tableIds[2], 420.00, 21.00, 441.00, 'UPI', 'PAID', 'ACCEPTED', null, '-10 minutes']
  );
  const order3Id = Number(order3Result.lastInsertRowid);
  await db.run(
    'INSERT INTO order_items (order_id, menu_item_id, item_name_snapshot, unit_price_snapshot, quantity, total) VALUES (?, ?, ?, ?, ?, ?)',
    [order3Id, insertedMenuItemIds[6], 'Classic Margherita Wood-Fired Pizza', 420.00, 1, 420.00]
  );
  await db.run(
    "INSERT INTO payments (order_id, method, amount, status, transaction_reference, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', ?))",
    [order3Id, 'UPI', 441.00, 'PAID', 'UPI-REF-1092834712', '-10 minutes']
  );

  console.log('Seeded sample orders and payments.');
  console.log('--- Database Seed Complete ---');

  return { initialTokens, tableIds };
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
