CREATE TABLE `pricingHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`zoneId` int NOT NULL,
	`changedBy` varchar(100),
	`changeNote` text,
	`previousValues` text,
	`newValues` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pricingHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pricingZones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cityName` varchar(100) NOT NULL,
	`cityNameAr` varchar(100) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`isDefault` boolean NOT NULL DEFAULT false,
	`pricingMethod` enum('per_km','per_minute','hybrid') NOT NULL DEFAULT 'per_km',
	`vehicleType` enum('sedan','suv','minivan','all') NOT NULL DEFAULT 'all',
	`baseFare` decimal(10,2) NOT NULL DEFAULT '2000',
	`pricePerKm` decimal(10,2) NOT NULL DEFAULT '1000',
	`pricePerMinute` decimal(10,2) NOT NULL DEFAULT '100',
	`minimumFare` decimal(10,2) NOT NULL DEFAULT '3000',
	`maximumFare` decimal(10,2) NOT NULL DEFAULT '0',
	`surgeMultiplier` decimal(4,2) NOT NULL DEFAULT '1.00',
	`peakHoursConfig` text,
	`nightSurchargeStart` varchar(5),
	`nightSurchargeEnd` varchar(5),
	`nightSurchargeAmount` decimal(10,2) DEFAULT '0',
	`bookingFee` decimal(10,2) NOT NULL DEFAULT '0',
	`freeWaitMinutes` int NOT NULL DEFAULT 3,
	`waitPricePerMinute` decimal(10,2) NOT NULL DEFAULT '0',
	`cancellationFee` decimal(10,2) NOT NULL DEFAULT '0',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updatedBy` varchar(100),
	CONSTRAINT `pricingZones_id` PRIMARY KEY(`id`)
);
