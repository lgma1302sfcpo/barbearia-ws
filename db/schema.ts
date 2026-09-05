import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const appointments = sqliteTable('appointments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(), professional: text('professional').notNull(), payment: text('payment').notNull(),
  service: text('service').notNull(), client: text('client').notNull().default('Cliente'),
  amountCents: integer('amount_cents').notNull(), time: text('time').notNull(), createdAt: text('created_at').notNull(),
}, (table) => [index('idx_appointments_date').on(table.date)]);

export const beverageProducts = sqliteTable('beverage_products', {
  id: integer('id').primaryKey({ autoIncrement: true }), name: text('name').notNull().unique(),
  priceCents: integer('price_cents').notNull(), stock: integer('stock').notNull().default(0),
});

export const beverageSales = sqliteTable('beverage_sales', {
  id: integer('id').primaryKey({ autoIncrement: true }), date: text('date').notNull(),
  productId: integer('product_id').notNull().references(() => beverageProducts.id), productName: text('product_name').notNull(),
  client: text('client').notNull().default('Cliente'), quantity: integer('quantity').notNull(),
  unitPriceCents: integer('unit_price_cents').notNull(), createdAt: text('created_at').notNull(),
}, (table) => [index('idx_beverage_sales_date').on(table.date)]);

export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }), date: text('date').notNull(), description: text('description').notNull(),
  category: text('category').notNull(), payment: text('payment').notNull(), amountCents: integer('amount_cents').notNull(), createdAt: text('created_at').notNull(),
}, (table) => [index('idx_expenses_date').on(table.date)]);
