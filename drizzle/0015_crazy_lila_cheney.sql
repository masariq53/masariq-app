CREATE TABLE `intercityMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`tripId` int NOT NULL,
	`senderType` enum('passenger','driver') NOT NULL,
	`senderId` int NOT NULL,
	`message` text NOT NULL,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `intercityMessages_id` PRIMARY KEY(`id`)
);
