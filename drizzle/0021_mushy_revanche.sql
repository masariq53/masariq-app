ALTER TABLE `supportTickets` ADD `rating` int;--> statement-breakpoint
ALTER TABLE `supportTickets` ADD `ratingComment` varchar(500);--> statement-breakpoint
ALTER TABLE `supportTickets` ADD `ratedAt` timestamp;