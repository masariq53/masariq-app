ALTER TABLE `intercityBookings` ADD `pickupAddress` text;--> statement-breakpoint
ALTER TABLE `intercityBookings` ADD `pickupLat` decimal(10,7);--> statement-breakpoint
ALTER TABLE `intercityBookings` ADD `pickupLng` decimal(10,7);--> statement-breakpoint
ALTER TABLE `intercityBookings` ADD `passengerRating` int;--> statement-breakpoint
ALTER TABLE `intercityBookings` ADD `driverRating` int;