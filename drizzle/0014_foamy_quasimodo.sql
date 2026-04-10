CREATE TABLE `intercityDriverLocations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tripId` int NOT NULL,
	`driverId` int NOT NULL,
	`lat` decimal(10,7) NOT NULL,
	`lng` decimal(10,7) NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `intercityDriverLocations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `intercityBookings` ADD `driverApproachStatus` enum('idle','heading','arrived_at_pickup') DEFAULT 'idle';--> statement-breakpoint
ALTER TABLE `intercityBookings` ADD `cancelledBy` varchar(100);--> statement-breakpoint
ALTER TABLE `intercityBookings` ADD `cancelReason` text;