ALTER TABLE `passengers` ADD `isBlocked` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `passengers` ADD `blockReason` text;--> statement-breakpoint
ALTER TABLE `passengers` ADD `city` varchar(100);--> statement-breakpoint
ALTER TABLE `passengers` ADD `country` varchar(100);