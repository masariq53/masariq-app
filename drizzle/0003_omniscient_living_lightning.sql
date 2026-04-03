ALTER TABLE `drivers` ADD `registrationStatus` enum('pending','approved','rejected') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `drivers` ADD `rejectionReason` text;--> statement-breakpoint
ALTER TABLE `drivers` ADD `nationalId` varchar(30);--> statement-breakpoint
ALTER TABLE `drivers` ADD `photoUrl` text;--> statement-breakpoint
ALTER TABLE `drivers` ADD `nationalIdPhotoUrl` text;--> statement-breakpoint
ALTER TABLE `drivers` ADD `licensePhotoUrl` text;--> statement-breakpoint
ALTER TABLE `drivers` ADD `vehicleYear` varchar(4);--> statement-breakpoint
ALTER TABLE `drivers` ADD `vehiclePhotoUrl` text;