CREATE TABLE `gateway_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`request_model` text NOT NULL,
	`target_model` text NOT NULL,
	`request_tokens` integer,
	`response_tokens` integer,
	`total_tokens` integer,
	`latency_ms` integer,
	`status_code` integer NOT NULL,
	`is_success` integer NOT NULL,
	`error_message` text,
	`provider_key_id` text,
	`stream_mode` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`provider_key_id`) REFERENCES `provider_keys`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `gateway_logs_user_id_idx` ON `gateway_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `gateway_logs_created_at_idx` ON `gateway_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `gateway_logs_provider_key_id_idx` ON `gateway_logs` (`provider_key_id`);--> statement-breakpoint
CREATE TABLE `provider_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`key_name` text NOT NULL,
	`encrypted_api_key` text NOT NULL,
	`base_url` text NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`weight` integer DEFAULT 1 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`last_used_at` integer,
	`last_failure_at` integer,
	`total_requests` integer DEFAULT 0 NOT NULL,
	`successful_requests` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `provider_keys_user_id_idx` ON `provider_keys` (`user_id`);--> statement-breakpoint
CREATE INDEX `provider_keys_enabled_idx` ON `provider_keys` (`enabled`);--> statement-breakpoint
CREATE TABLE `proxy_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`target_service` text NOT NULL,
	`proxy_url` text NOT NULL,
	`proxy_type` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `proxy_configs_target_service_idx` ON `proxy_configs` (`target_service`);--> statement-breakpoint
CREATE INDEX `proxy_configs_enabled_idx` ON `proxy_configs` (`enabled`);