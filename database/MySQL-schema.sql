CREATE DATABASE IF NOT EXISTS `morval_investor` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

USE morval_investor;

CREATE TABLE IF NOT EXISTS `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `role` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1: Investor | 2: Admin',
  `profile_img` varchar(255) DEFAULT NULL,
  `f_name` varchar(255) NOT NULL,
  `l_name` varchar(255) NOT NULL,
  `initial_capital` decimal(15,6) NOT NULL DEFAULT '0.000000',
  `current_portfolio` decimal(15,6) NOT NULL DEFAULT '0.000000',
  `currency` varchar(10) NOT NULL DEFAULT 'AUD',
  `contract_start_date` date DEFAULT NULL,
  `contract_type` tinyint(1) DEFAULT 0 COMMENT '0: monthly_payable | 1: monthly_compounding',
  `fixed_interest_rate` DECIMAL(5,2) DEFAULT NULL,
  `contract_end_date` DATE DEFAULT NULL,
  `investment_day` tinyint DEFAULT NULL COMMENT 'Day of month for payment scheduling (1-31)',
  `is_bank_details` tinyint(1) NOT NULL DEFAULT '0' COMMENT '0: No bank details | 1: Bank details submitted',
  `email` varchar(128) NOT NULL,
  `temp_password` varchar(255) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `email_verified` tinyint(1) NOT NULL DEFAULT '0',
  `temp_signup` tinyint(1) DEFAULT '0' COMMENT '1: temp | 0: normal',
  `status` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1: active | 0: pending | -1: delete | 2: disabled',
  `last_login_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `email` (`email`),
  KEY `role` (`role`),
  KEY `idx_contract_type` (`contract_type`),
  KEY `idx_contract_end_date` (`contract_end_date`),
  KEY `idx_investment_day` (`investment_day`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `user_auth` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `apikey` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `ev_token` varchar(255) DEFAULT NULL,
  `fp_token` varchar(255) DEFAULT NULL,
  `status` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `investor_bank_details` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `account_holder_name` varchar(255) NOT NULL,
  `bank_name` varchar(255) NOT NULL,
  `iban` varchar(34) NULL COMMENT 'International Bank Account Number',
  `account_number` varchar(50) NOT NULL,
  `swift_code` varchar(50) DEFAULT NULL,
  `bsb_number` varchar(50) DEFAULT NULL,
  `beneficiary_address` text,
  `status` tinyint(1) NOT NULL DEFAULT '0' COMMENT '0: pending | 1: approved | 2: rejected',
  `reject_reason` text DEFAULT NULL,
  `reviewed_by` bigint DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `type` varchar(50) NOT NULL,
  `type_id` bigint DEFAULT NULL,
  `payload` json DEFAULT NULL,
  `status` tinyint(1) NOT NULL DEFAULT '0' COMMENT '0: unread | 1: read',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `fcm_tokens` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `fcm_token` varchar(255) NOT NULL,
  `device_type` varchar(50) DEFAULT NULL COMMENT 'ios | android | web',
  `status` tinyint(1) NOT NULL DEFAULT '1' COMMENT '0: inactive | 1: active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_token` (`user_id`,`fcm_token`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `investor_portfolio_performance` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `month` tinyint NOT NULL COMMENT 'Month (1-12)',
  `year` int NOT NULL,
  `portfolio_value_before` decimal(15,6) NOT NULL,
  `portfolio_value_after` decimal(15,6) NOT NULL,
  `portfolio_value` decimal(15,6) NOT NULL,
  `profit_amount` decimal(15,6) NOT NULL,
  `profit_percentage` decimal(8,2) NOT NULL,
  `notes` text DEFAULT NULL,
  `added_by` bigint NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_month_year` (`user_id`,`month`,`year`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_year_month` (`year`,`month`),
  KEY `idx_added_by` (`added_by`),
  KEY `idx_user_year_month` (`user_id`, `year`, `month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `admin_dashboard_stats` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `stat_name` varchar(100) NOT NULL,
  `stat_value` decimal(15,6) NOT NULL DEFAULT '0.000000',
  `display_order` int NOT NULL DEFAULT '0',
  `status` tinyint(1) NOT NULL DEFAULT '1' COMMENT '0: inactive | 1: active',
  `created_by` bigint NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_stat_name` (`stat_name`),
  KEY `idx_status` (`status`),
  KEY `idx_display_order` (`display_order`),
  KEY `idx_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `fund_performance` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `month` tinyint NOT NULL COMMENT 'Month (1-12)',
  `year` int NOT NULL,
  `performance_percentage` DECIMAL(5,2) NOT NULL,
  `total_fund_value_before` DECIMAL(15,6) NOT NULL,
  `total_fund_value_after` DECIMAL(15,6) NOT NULL,
  `monthly_payables_total` DECIMAL(15,6) NOT NULL DEFAULT '0.000000',
  `adjusted_fund_value` DECIMAL(15,6) NOT NULL,
  `adjusted_performance_percentage` DECIMAL(5,2) NOT NULL,
  `notes` TEXT NULL,
  `added_by` bigint NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_month_year` (`month`, `year`),
  KEY `idx_added_by` (`added_by`),
  KEY `idx_year_month` (`year`, `month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `capital_tranches` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `tranche_number` int NOT NULL,
  `capital_amount` DECIMAL(15,6) NOT NULL,
  `investment_date` DATE NOT NULL,
  `status` tinyint(1) NOT NULL DEFAULT 1 COMMENT '0: withdrawn | 1: active',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  UNIQUE KEY `unique_user_tranche` (`user_id`, `tranche_number`),
  KEY `idx_status` (`status`),
  KEY `idx_investment_date` (`investment_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `payment_schedules` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `due_date` DATE NOT NULL,
  `payment_amount` DECIMAL(15,6) NOT NULL,
  `payment_type` tinyint(1) NOT NULL COMMENT '0: monthly_interest | 1: compound_maturity',
  `principal_amount` DECIMAL(15,6) NOT NULL,
  `status` tinyint(1) NOT NULL DEFAULT 0 COMMENT '0: pending | 1: paid | 2: overdue',
  `paid_date` DATE NULL,
  `notes` TEXT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_due_date` (`due_date`),
  KEY `idx_status` (`status`),
  KEY `idx_payment_type` (`payment_type`),
  KEY `idx_user_due_date` (`user_id`, `due_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Database triggers for automatic portfolio synchronization
DELIMITER $$
CREATE TRIGGER `sync_portfolio_on_insert` 
AFTER INSERT ON `investor_portfolio_performance`
FOR EACH ROW
BEGIN
    UPDATE `users` 
    SET `current_portfolio` = NEW.portfolio_value,
        `updated_at` = CURRENT_TIMESTAMP
    WHERE `id` = NEW.user_id;
END$$


CREATE TRIGGER `sync_portfolio_on_update` 
AFTER UPDATE ON `investor_portfolio_performance`
FOR EACH ROW
BEGIN
    UPDATE `users` 
    SET `current_portfolio` = NEW.portfolio_value,
        `updated_at` = CURRENT_TIMESTAMP
    WHERE `id` = NEW.user_id;
END$$


CREATE TRIGGER `sync_portfolio_on_delete` 
AFTER DELETE ON `investor_portfolio_performance`
FOR EACH ROW
BEGIN

    UPDATE `users` u
    SET `current_portfolio` = COALESCE(
        (SELECT `portfolio_value` 
         FROM `investor_portfolio_performance` 
         WHERE `user_id` = OLD.user_id 
         ORDER BY `year` DESC, `month` DESC 
         LIMIT 1),
        u.initial_capital
    ),
    `updated_at` = CURRENT_TIMESTAMP
    WHERE `id` = OLD.user_id;
END$$



DELIMITER ;
