CREATE TABLE `commissionSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceType` enum('city_ride','intercity','parcel') NOT NULL,
	`commissionRate` decimal(5,2) NOT NULL DEFAULT '10.00',
	`isActive` boolean NOT NULL DEFAULT true,
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `commissionSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `commissionSettings_serviceType_unique` UNIQUE(`serviceType`)
);
--> statement-breakpoint
CREATE TABLE `driverCommissionOverrides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`driverId` int NOT NULL,
	`serviceType` enum('city_ride','intercity','parcel') NOT NULL,
	`commissionRate` decimal(5,2) NOT NULL,
	`reason` varchar(300),
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `driverCommissionOverrides_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userDiscounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`passengerId` int NOT NULL,
	`discountType` enum('free_rides','percentage','fixed_amount') NOT NULL,
	`totalFreeRides` int NOT NULL DEFAULT 0,
	`usedFreeRides` int NOT NULL DEFAULT 0,
	`discountValue` decimal(10,2) NOT NULL DEFAULT '0.00',
	`applicableServices` varchar(100) NOT NULL DEFAULT 'all',
	`validFrom` timestamp NOT NULL DEFAULT (now()),
	`validUntil` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`reason` varchar(300),
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userDiscounts_id` PRIMARY KEY(`id`)
);
