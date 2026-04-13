CREATE TABLE `agentTopupLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`amount` decimal(15,2) NOT NULL,
	`balanceBefore` decimal(15,2) NOT NULL,
	`balanceAfter` decimal(15,2) NOT NULL,
	`notes` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agentTopupLogs_id` PRIMARY KEY(`id`)
);
