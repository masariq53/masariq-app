CREATE TABLE `rideMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rideId` int NOT NULL,
	`senderType` enum('passenger','driver') NOT NULL,
	`senderId` int NOT NULL,
	`message` text NOT NULL,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rideMessages_id` PRIMARY KEY(`id`)
);
