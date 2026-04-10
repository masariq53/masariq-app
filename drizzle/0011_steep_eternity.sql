ALTER TABLE `intercityBookings` ADD `passengerNote` text;--> statement-breakpoint
ALTER TABLE `intercityBookings` ADD `pickupStatus` enum('waiting','picked_up','arrived') DEFAULT 'waiting';