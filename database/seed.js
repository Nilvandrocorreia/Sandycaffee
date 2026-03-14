const bcrypt = require('bcryptjs');
const { getDb } = require('./db');

async function seed() {
  const db = getDb();

  // Check if admin already exists
  const adminExists = await db.get('SELECT id FROM users WHERE role = ? LIMIT 1', ['administrator']);
  if (adminExists) {
    console.log('Database already seeded, skipping...');
    return;
  }

  console.log('Seeding database...');

  const adminHash = bcrypt.hashSync('admin123', 10);
  const cashierHash = bcrypt.hashSync('cashier123', 10);
  const kitchenHash = bcrypt.hashSync('kitchen123', 10);

  await db.run('INSERT INTO users (name, email, password, role, active) VALUES (?, ?, ?, ?, 1)', ['admin', 'admin@sandycaffee.com', adminHash, 'administrator']);
  await db.run('INSERT INTO users (name, email, password, role, active) VALUES (?, ?, ?, ?, 1)', ['Sarah', 'sarah@sandycaffee.com', cashierHash, 'cashier']);
  await db.run('INSERT INTO users (name, email, password, role, active) VALUES (?, ?, ?, ?, 1)', ['Chef Tom', 'tom@sandycaffee.com', kitchenHash, 'kitchen']);

  const hotDrinks = await db.run('INSERT INTO categories (name, emoji, colour) VALUES (?, ?, ?)', ['Hot Drinks', '☕', '#8B4513']);
  const coldDrinks = await db.run('INSERT INTO categories (name, emoji, colour) VALUES (?, ?, ?)', ['Cold Drinks', '🧊', '#4169E1']);
  const food = await db.run('INSERT INTO categories (name, emoji, colour) VALUES (?, ?, ?)', ['Food', '🍰', '#FF8C00']);

  const espresso = await db.run('INSERT INTO products (name, price, category_id, stock, min_stock, active) VALUES (?, ?, ?, ?, ?, 1)', ['Espresso', 2.50, hotDrinks.lastID, 50, 10]);
  const latte = await db.run('INSERT INTO products (name, price, category_id, stock, min_stock, active) VALUES (?, ?, ?, ?, ?, 1)', ['Latte', 3.20, hotDrinks.lastID, 40, 10]);
  await db.run('INSERT INTO products (name, price, category_id, stock, min_stock, active) VALUES (?, ?, ?, ?, ?, 1)', ['Iced Coffee', 3.50, coldDrinks.lastID, 30, 10]);
  const croissant = await db.run('INSERT INTO products (name, price, category_id, stock, min_stock, active) VALUES (?, ?, ?, ?, ?, 1)', ['Croissant', 2.80, food.lastID, 20, 5]);
  const chocolateCake = await db.run('INSERT INTO products (name, price, category_id, stock, min_stock, active) VALUES (?, ?, ?, ?, ?, 1)', ['Chocolate Cake', 4.50, food.lastID, 15, 5]);

  const meal1 = await db.run('INSERT INTO meals (name, price, description, active) VALUES (?, ?, ?, 1)', ['Coffee & Croissant', 5.00, 'Espresso + Croissant combo']);
  const meal2 = await db.run('INSERT INTO meals (name, price, description, active) VALUES (?, ?, ?, 1)', ['Afternoon Tea', 7.50, 'Latte + Chocolate Cake combo']);

  await db.run('INSERT INTO meal_items (meal_id, product_id, quantity) VALUES (?, ?, ?)', [meal1.lastID, espresso.lastID, 1]);
  await db.run('INSERT INTO meal_items (meal_id, product_id, quantity) VALUES (?, ?, ?)', [meal1.lastID, croissant.lastID, 1]);
  await db.run('INSERT INTO meal_items (meal_id, product_id, quantity) VALUES (?, ?, ?)', [meal2.lastID, latte.lastID, 1]);
  await db.run('INSERT INTO meal_items (meal_id, product_id, quantity) VALUES (?, ?, ?)', [meal2.lastID, chocolateCake.lastID, 1]);

  await db.run('INSERT INTO tables (number, name, active) VALUES (?, ?, 1)', [1, 'Table 1']);
  await db.run('INSERT INTO tables (number, name, active) VALUES (?, ?, 1)', [2, 'Table 2']);
  await db.run('INSERT INTO tables (number, name, active) VALUES (?, ?, 1)', [3, 'Table 3']);

  console.log('Database seeded successfully!');
}

module.exports = seed;
