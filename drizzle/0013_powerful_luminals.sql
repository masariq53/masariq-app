ALTER TABLE `intercityTrips` ADD `cancelReason` text;--> statement-breakpoint
ALTER TABLE `intercityTrips` ADD `cancelledBy` enum('driver','admin');