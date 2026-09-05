CREATE INDEX `idx_appointments_date` ON `appointments` (`date`);--> statement-breakpoint
CREATE INDEX `idx_beverage_sales_date` ON `beverage_sales` (`date`);--> statement-breakpoint
CREATE INDEX `idx_expenses_date` ON `expenses` (`date`);--> statement-breakpoint
PRAGMA optimize;
