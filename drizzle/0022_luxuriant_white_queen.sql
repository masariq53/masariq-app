CREATE TABLE `agentTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`recipientType` enum('driver','passenger') NOT NULL,
	`recipientId` int NOT NULL,
	`recipientName` varchar(100),
	`recipientPhone` varchar(20),
	`amount` decimal(15,2) NOT NULL,
	`agentBalanceBefore` decimal(15,2) NOT NULL,
	`agentBalanceAfter` decimal(15,2) NOT NULL,
	`notes` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agentTransactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`passengerId` int NOT NULL,
	`phone` varchar(20) NOT NULL,
	`name` varchar(100) NOT NULL,
	`facePhotoUrl` text,
	`idFrontUrl` text,
	`idBackUrl` text,
	`officePhotoUrl` text,
	`officeAddress` varchar(500),
	`officeLatitude` float,
	`officeLongitude` float,
	`status` enum('pending','approved','rejected','suspended') NOT NULL DEFAULT 'pending',
	`rejectionReason` varchar(500),
	`balance` decimal(15,2) NOT NULL DEFAULT '0',
	`totalRecharges` int NOT NULL DEFAULT 0,
	`totalRechargeAmount` decimal(15,2) NOT NULL DEFAULT '0',
	`adminNotes` text,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agents_id` PRIMARY KEY(`id`)
);
