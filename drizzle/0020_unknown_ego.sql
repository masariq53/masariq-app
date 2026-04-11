CREATE TABLE `supportMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int NOT NULL,
	`senderType` enum('user','admin') NOT NULL,
	`senderName` varchar(100),
	`message` text NOT NULL,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `supportMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supportTickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userType` enum('passenger','driver') NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(100),
	`userPhone` varchar(20),
	`category` enum('payment','ride','account','driver','passenger','app','other') NOT NULL DEFAULT 'other',
	`subject` varchar(200) NOT NULL,
	`status` enum('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
	`priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
	`rideId` int,
	`tripId` int,
	`lastRepliedAt` timestamp,
	`lastRepliedBy` enum('user','admin'),
	`unreadByAdmin` int NOT NULL DEFAULT 0,
	`unreadByUser` int NOT NULL DEFAULT 0,
	`closedAt` timestamp,
	`closedBy` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `supportTickets_id` PRIMARY KEY(`id`)
);
