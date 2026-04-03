CREATE TABLE `drivers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone` varchar(20) NOT NULL,
	`name` varchar(100) NOT NULL,
	`isVerified` boolean NOT NULL DEFAULT false,
	`isOnline` boolean NOT NULL DEFAULT false,
	`isAvailable` boolean NOT NULL DEFAULT false,
	`vehicleType` enum('sedan','suv','minivan') NOT NULL DEFAULT 'sedan',
	`vehiclePlate` varchar(20),
	`vehicleModel` varchar(100),
	`vehicleColor` varchar(50),
	`currentLat` decimal(10,7),
	`currentLng` decimal(10,7),
	`rating` decimal(3,2) DEFAULT '5.00',
	`totalRides` int NOT NULL DEFAULT 0,
	`walletBalance` decimal(10,2) NOT NULL DEFAULT '0.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastActiveAt` timestamp DEFAULT (now()),
	CONSTRAINT `drivers_id` PRIMARY KEY(`id`),
	CONSTRAINT `drivers_phone_unique` UNIQUE(`phone`)
);
--> statement-breakpoint
CREATE TABLE `otpCodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone` varchar(20) NOT NULL,
	`code` varchar(6) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`isUsed` boolean NOT NULL DEFAULT false,
	`attempts` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `otpCodes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `passengers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone` varchar(20) NOT NULL,
	`name` varchar(100),
	`isVerified` boolean NOT NULL DEFAULT false,
	`walletBalance` decimal(10,2) NOT NULL DEFAULT '0.00',
	`totalRides` int NOT NULL DEFAULT 0,
	`rating` decimal(3,2) DEFAULT '5.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastActiveAt` timestamp DEFAULT (now()),
	CONSTRAINT `passengers_id` PRIMARY KEY(`id`),
	CONSTRAINT `passengers_phone_unique` UNIQUE(`phone`)
);
--> statement-breakpoint
CREATE TABLE `rides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`passengerId` int NOT NULL,
	`driverId` int,
	`status` enum('searching','accepted','driver_arrived','in_progress','completed','cancelled') NOT NULL DEFAULT 'searching',
	`pickupLat` decimal(10,7) NOT NULL,
	`pickupLng` decimal(10,7) NOT NULL,
	`pickupAddress` text,
	`dropoffLat` decimal(10,7) NOT NULL,
	`dropoffLng` decimal(10,7) NOT NULL,
	`dropoffAddress` text,
	`estimatedDistance` decimal(8,2),
	`estimatedDuration` int,
	`fare` decimal(10,2),
	`paymentMethod` enum('cash','wallet') DEFAULT 'cash',
	`passengerRating` int,
	`driverRating` int,
	`cancelReason` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rides_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `walletTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userType` enum('passenger','driver') NOT NULL,
	`type` enum('credit','debit') NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`description` text,
	`rideId` int,
	`balanceBefore` decimal(10,2),
	`balanceAfter` decimal(10,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `walletTransactions_id` PRIMARY KEY(`id`)
);
