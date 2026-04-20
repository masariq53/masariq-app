CREATE TABLE `driverFreeRides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`driverId` int NOT NULL,
	`totalFreeRides` int NOT NULL DEFAULT 25,
	`usedFreeRides` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`grantedBy` int,
	`grantReason` varchar(300),
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `driverFreeRides_id` PRIMARY KEY(`id`),
	CONSTRAINT `driverFreeRides_driverId_unique` UNIQUE(`driverId`)
);
