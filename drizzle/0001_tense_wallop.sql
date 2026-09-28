CREATE TABLE `overlay_links` (
	`stream_key` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `overlay_links_token_unique` ON `overlay_links` (`token`);