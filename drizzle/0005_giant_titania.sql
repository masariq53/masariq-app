ALTER TABLE `drivers` ADD `isBlocked` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `drivers` ADD `blockReason` text;