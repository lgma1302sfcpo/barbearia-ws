CREATE TABLE `appointments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`professional` text NOT NULL,
	`payment` text NOT NULL,
	`service` text NOT NULL,
	`client` text DEFAULT 'Cliente' NOT NULL,
	`amount_cents` integer NOT NULL,
	`time` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `beverage_products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`price_cents` integer NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `beverage_products_name_unique` ON `beverage_products` (`name`);--> statement-breakpoint
CREATE TABLE `beverage_sales` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`product_id` integer NOT NULL,
	`product_name` text NOT NULL,
	`client` text DEFAULT 'Cliente' NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `beverage_products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`payment` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`created_at` text NOT NULL
);
