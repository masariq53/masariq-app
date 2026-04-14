CREATE TABLE `paymentMethodSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`method` enum('mastercard','zaincash','fib') NOT NULL,
	`displayName` varchar(100) NOT NULL,
	`accountNumber` varchar(200) NOT NULL,
	`accountName` varchar(200),
	`instructions` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paymentMethodSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `paymentMethodSettings_method_unique` UNIQUE(`method`)
);
--> statement-breakpoint
CREATE TABLE `walletTopupRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userType` enum('driver','passenger') NOT NULL,
	`paymentMethod` enum('mastercard','zaincash','fib') NOT NULL,
	`amount` decimal(15,2) NOT NULL,
	`receiptUrl` text,
	`note` varchar(500),
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`adminNote` varchar(500),
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `walletTopupRequests_id` PRIMARY KEY(`id`)
);
