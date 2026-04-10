CREATE TABLE `intercityBookings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tripId` int NOT NULL,
	`passengerId` int NOT NULL,
	`seatsBooked` int NOT NULL DEFAULT 1,
	`totalPrice` decimal(10,2) NOT NULL,
	`status` enum('pending','confirmed','cancelled') NOT NULL DEFAULT 'confirmed',
	`passengerPhone` varchar(20),
	`passengerName` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `intercityBookings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `intercityTrips` (
	`id` int AUTO_INCREMENT NOT NULL,
	`driverId` int NOT NULL,
	`fromCity` varchar(100) NOT NULL,
	`toCity` varchar(100) NOT NULL,
	`departureTime` timestamp NOT NULL,
	`totalSeats` int NOT NULL DEFAULT 4,
	`availableSeats` int NOT NULL DEFAULT 4,
	`pricePerSeat` decimal(10,2) NOT NULL,
	`meetingPoint` text,
	`notes` text,
	`status` enum('scheduled','in_progress','completed','cancelled') NOT NULL DEFAULT 'scheduled',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `intercityTrips_id` PRIMARY KEY(`id`)
);
