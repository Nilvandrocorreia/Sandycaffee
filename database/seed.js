const bcrypt = require('bcryptjs');
const db = require('./db');

async function seed() {
  // Check if admin already exists
  const adminExists = db.prepare('SELECT id FROM users WHERE role = ? LIMIT 1').get('administrator');
  if (adminExists) {
    console.log('Database already seeded, skipping...');
    return;
  }

  console.log('Seeding database...');

  // Hash passwords
  const adminHash = bcrypt.hashSync('admin123', 10);
  const cashierHash = bcrypt.hashSync('cashier123', 10);
  const kitchenHash = bcrypt.hashSync('kitchen123', 10);

  // Seed users
  const insertUser = db.prepare(
    'INSERT INTO users (name, email, password, role, active) VALUES (?, ?, ?, ?, 1)'
  );
  insertUser.run('admin', 'admin@sandycaffee.com', adminHash, 'administrator');
  insertUser.run('Sarah', 'sarah@sandycaffee.com', cashierHash, 'cashier');
  insertUser.run('Chef Tom', 'tom@sandycaffee.com', kitchenHash, 'kitchen');

  // Seed categories
  const insertCategory = db.prepare(
    'INSERT INTO categories (name, emoji, colour) VALUES (?, ?, ?)'
  );
  const hotDrinks = insertCategory.run('Hot Drinks', '☕', '#8B4513');
  const coldDrinks = insertCategory.run('Cold Drinks', '🧊', '#4169E1');
  const food = insertCategory.run('Food', '🍰', '#FF8C00');

  // Seed products
  const insertProduct = db.prepare(
    'INSERT INTO products (name, price, category_id, stock, min_stock, active) VALUES (?, ?, ?, ?, ?, 1)'
  );
  const espresso = insertProduct.run('Espresso', 2.50, hotDrinks.lastInsertRowid, 50, 10);
  const latte = insertProduct.run('Latte', 3.20, hotDrinks.lastInsertRowid, 40, 10);
  const icedCoffee = insertProduct.run('Iced Coffee', 3.50, coldDrinks.lastInsertRowid, 30, 10);
  const croissant = insertProduct.run('Croissant', 2.80, food.lastInsertRowid, 20, 5);
  const chocolateCake = insertProduct.run('Chocolate Cake', 4.50, food.lastInsertRowid, 15, 5);

  // Seed meals
  const insertMeal = db.prepare(
    'INSERT INTO meals (name, price, description, active) VALUES (?, ?, ?, 1)'
  );
  const meal1 = insertMeal.run('Coffee & Croissant', 5.00, 'Espresso + Croissant combo');
  const meal2 = insertMeal.run('Afternoon Tea', 7.50, 'Latte + Chocolate Cake combo');

  const insertMealItem = db.prepare(
    'INSERT INTO meal_items (meal_id, product_id, quantity) VALUES (?, ?, ?)'
  );
  insertMealItem.run(meal1.lastInsertRowid, espresso.lastInsertRowid, 1);
  insertMealItem.run(meal1.lastInsertRowid, croissant.lastInsertRowid, 1);
  insertMealItem.run(meal2.lastInsertRowid, latte.lastInsertRowid, 1);
  insertMealItem.run(meal2.lastInsertRowid, chocolateCake.lastInsertRowid, 1);

  // Seed tables (QR codes generated later by the tables route)
  const insertTable = db.prepare(
    'INSERT INTO tables (number, name, active) VALUES (?, ?, 1)'
  );
  insertTable.run(1, 'Table 1');
  insertTable.run(2, 'Table 2');
  insertTable.run(3, 'Table 3');

  console.log('Database seeded successfully!');
}

module.exports = seed;
