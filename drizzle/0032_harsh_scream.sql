ALTER TABLE `pricingZones` MODIFY COLUMN `pricingMethod` enum('per_km','per_minute','hybrid','zones') NOT NULL DEFAULT 'per_km';--> statement-breakpoint
ALTER TABLE `pricingZones` ADD `zonesConfig` text;--> statement-breakpoint
ALTER TABLE `pricingZones` ADD `captainRadiusKm` decimal(5,2) DEFAULT '2.00';