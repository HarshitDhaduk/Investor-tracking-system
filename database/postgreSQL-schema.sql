-- PostgreSQL Schema for Morval Investor

-- Note: Database creation is usually done outside the script or via \c
-- CREATE DATABASE morval_investor;

CREATE TABLE IF NOT EXISTS "users" (
  "id" BIGSERIAL PRIMARY KEY,
  "role" SMALLINT NOT NULL DEFAULT 1, -- 1: Investor | 2: Admin
  "profile_img" VARCHAR(255) DEFAULT NULL,
  "f_name" VARCHAR(255) NOT NULL,
  "l_name" VARCHAR(255) NOT NULL,
  "initial_capital" DECIMAL(15,6) NOT NULL DEFAULT 0.000000,
  "current_portfolio" DECIMAL(15,6) NOT NULL DEFAULT 0.000000,
  "currency" VARCHAR(10) NOT NULL DEFAULT 'AUD',
  "contract_start_date" DATE DEFAULT NULL,
  "contract_type" SMALLINT DEFAULT 0, -- 0: monthly_payable | 1: monthly_compounding
  "fixed_interest_rate" DECIMAL(5,2) DEFAULT NULL,
  "contract_end_date" DATE DEFAULT NULL,
  "investment_day" SMALLINT DEFAULT NULL, -- Day of month for payment scheduling (1-31)
  "is_bank_details" SMALLINT NOT NULL DEFAULT 0, -- 0: No bank details | 1: Bank details submitted
  "email" VARCHAR(128) NOT NULL,
  "temp_password" VARCHAR(255) DEFAULT NULL,
  "password" VARCHAR(255) DEFAULT NULL,
  "email_verified" SMALLINT NOT NULL DEFAULT 0,
  "temp_signup" SMALLINT DEFAULT 0, -- 1: temp | 0: normal
  "status" SMALLINT NOT NULL DEFAULT 0, -- 1: active | 0: pending | -1: delete | 2: disabled
  "last_login_at" TIMESTAMPTZ DEFAULT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON "users" ("email");
CREATE INDEX idx_users_role ON "users" ("role");
CREATE INDEX idx_users_contract_type ON "users" ("contract_type");
CREATE INDEX idx_users_contract_end_date ON "users" ("contract_end_date");
CREATE INDEX idx_users_investment_day ON "users" ("investment_day");

CREATE TABLE IF NOT EXISTS "user_auth" (
  "id" BIGSERIAL PRIMARY KEY,
  "user_id" BIGINT NOT NULL REFERENCES "users"("id"),
  "apikey" VARCHAR(255) NOT NULL,
  "token" VARCHAR(255) NOT NULL,
  "ev_token" VARCHAR(255) DEFAULT NULL,
  "fp_token" VARCHAR(255) DEFAULT NULL,
  "status" SMALLINT NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_auth_user_id UNIQUE ("user_id")
);

CREATE INDEX idx_user_auth_user_id ON "user_auth" ("user_id");

CREATE TABLE IF NOT EXISTS "investor_bank_details" (
  "id" BIGSERIAL PRIMARY KEY,
  "user_id" BIGINT NOT NULL REFERENCES "users"("id"),
  "account_holder_name" VARCHAR(255) NOT NULL,
  "bank_name" VARCHAR(255) NOT NULL,
  "iban" VARCHAR(34) DEFAULT NULL,
  "account_number" VARCHAR(50) NOT NULL,
  "swift_code" VARCHAR(50) DEFAULT NULL,
  "bsb_number" VARCHAR(50) DEFAULT NULL,
  "beneficiary_address" TEXT,
  "status" SMALLINT NOT NULL DEFAULT 0, -- 0: pending | 1: approved | 2: rejected
  "reject_reason" TEXT DEFAULT NULL,
  "reviewed_by" BIGINT DEFAULT NULL,
  "reviewed_at" TIMESTAMPTZ DEFAULT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bank_details_user_id ON "investor_bank_details" ("user_id");
CREATE INDEX idx_bank_details_status ON "investor_bank_details" ("status");

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" BIGSERIAL PRIMARY KEY,
  "user_id" BIGINT NOT NULL REFERENCES "users"("id"),
  "title" VARCHAR(255) NOT NULL,
  "message" TEXT NOT NULL,
  "type" VARCHAR(50) NOT NULL,
  "type_id" BIGINT DEFAULT NULL,
  "payload" JSONB DEFAULT NULL,
  "status" SMALLINT NOT NULL DEFAULT 0, -- 0: unread | 1: read
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_id ON "notifications" ("user_id");
CREATE INDEX idx_notifications_status ON "notifications" ("status");
CREATE INDEX idx_notifications_type ON "notifications" ("type");

CREATE TABLE IF NOT EXISTS "fcm_tokens" (
  "id" BIGSERIAL PRIMARY KEY,
  "user_id" BIGINT NOT NULL REFERENCES "users"("id"),
  "fcm_token" VARCHAR(255) NOT NULL,
  "device_type" VARCHAR(50) DEFAULT NULL, -- ios | android | web
  "status" SMALLINT NOT NULL DEFAULT 1, -- 0: inactive | 1: active
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_token UNIQUE ("user_id", "fcm_token")
);

CREATE INDEX idx_fcm_tokens_user_id ON "fcm_tokens" ("user_id");

CREATE TABLE IF NOT EXISTS "investor_portfolio_performance" (
  "id" BIGSERIAL PRIMARY KEY,
  "user_id" BIGINT NOT NULL REFERENCES "users"("id"),
  "month" SMALLINT NOT NULL,
  "year" INT NOT NULL,
  "portfolio_value_before" DECIMAL(15,6) NOT NULL,
  "portfolio_value_after" DECIMAL(15,6) NOT NULL,
  "portfolio_value" DECIMAL(15,6) NOT NULL,
  "profit_amount" DECIMAL(15,6) NOT NULL,
  "profit_percentage" DECIMAL(8,2) NOT NULL,
  "notes" TEXT DEFAULT NULL,
  "added_by" BIGINT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_month_year UNIQUE ("user_id", "month", "year")
);

CREATE INDEX idx_performance_user_id ON "investor_portfolio_performance" ("user_id");
CREATE INDEX idx_performance_year_month ON "investor_portfolio_performance" ("year", "month");
CREATE INDEX idx_performance_added_by ON "investor_portfolio_performance" ("added_by");
CREATE INDEX idx_performance_combined ON "investor_portfolio_performance" ("user_id", "year", "month");

CREATE TABLE IF NOT EXISTS "admin_dashboard_stats" (
  "id" BIGSERIAL PRIMARY KEY,
  "stat_name" VARCHAR(100) NOT NULL,
  "stat_value" DECIMAL(15,6) NOT NULL DEFAULT 0.000000,
  "display_order" INT NOT NULL DEFAULT 0,
  "status" SMALLINT NOT NULL DEFAULT 1, -- 0: inactive | 1: active
  "created_by" BIGINT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_stat_name UNIQUE ("stat_name")
);

CREATE INDEX idx_dashboard_stats_status ON "admin_dashboard_stats" ("status");
CREATE INDEX idx_dashboard_stats_order ON "admin_dashboard_stats" ("display_order");
CREATE INDEX idx_dashboard_stats_creator ON "admin_dashboard_stats" ("created_by");

CREATE TABLE IF NOT EXISTS "fund_performance" (
  "id" BIGSERIAL PRIMARY KEY,
  "month" SMALLINT NOT NULL,
  "year" INT NOT NULL,
  "performance_percentage" DECIMAL(5,2) NOT NULL,
  "total_fund_value_before" DECIMAL(15,6) NOT NULL,
  "total_fund_value_after" DECIMAL(15,6) NOT NULL,
  "monthly_payables_total" DECIMAL(15,6) NOT NULL DEFAULT 0.000000,
  "adjusted_fund_value" DECIMAL(15,6) NOT NULL,
  "adjusted_performance_percentage" DECIMAL(5,2) NOT NULL,
  "notes" TEXT DEFAULT NULL,
  "added_by" BIGINT NOT NULL,
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_fund_month_year UNIQUE ("month", "year")
);

CREATE INDEX idx_fund_performance_added_by ON "fund_performance" ("added_by");
CREATE INDEX idx_fund_performance_year_month ON "fund_performance" ("year", "month");

CREATE TABLE IF NOT EXISTS "capital_tranches" (
  "id" BIGSERIAL PRIMARY KEY,
  "user_id" BIGINT NOT NULL REFERENCES "users"("id"),
  "tranche_number" INT NOT NULL,
  "capital_amount" DECIMAL(15,6) NOT NULL,
  "investment_date" DATE NOT NULL,
  "status" SMALLINT NOT NULL DEFAULT 1, -- 0: withdrawn | 1: active
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_tranche UNIQUE ("user_id", "tranche_number")
);

CREATE INDEX idx_tranches_user_id ON "capital_tranches" ("user_id");
CREATE INDEX idx_tranches_status ON "capital_tranches" ("status");
CREATE INDEX idx_tranches_date ON "capital_tranches" ("investment_date");

CREATE TABLE IF NOT EXISTS "payment_schedules" (
  "id" BIGSERIAL PRIMARY KEY,
  "user_id" BIGINT NOT NULL REFERENCES "users"("id"),
  "due_date" DATE NOT NULL,
  "payment_amount" DECIMAL(15,6) NOT NULL,
  "payment_type" SMALLINT NOT NULL, -- 0: monthly_interest | 1: compound_maturity
  "principal_amount" DECIMAL(15,6) NOT NULL,
  "status" SMALLINT NOT NULL DEFAULT 0, -- 0: pending | 1: paid | 2: overdue
  "paid_date" DATE DEFAULT NULL,
  "notes" TEXT DEFAULT NULL,
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_user_id ON "payment_schedules" ("user_id");
CREATE INDEX idx_payments_due_date ON "payment_schedules" ("due_date");
CREATE INDEX idx_payments_status ON "payment_schedules" ("status");
CREATE INDEX idx_payments_type ON "payment_schedules" ("payment_type");
CREATE INDEX idx_payments_combined ON "payment_schedules" ("user_id", "due_date");

-- Function to handle updated_at triggers
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to synchronize portfolio on performance changes
CREATE OR REPLACE FUNCTION sync_portfolio_value()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        UPDATE "users" 
        SET current_portfolio = NEW.portfolio_value,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.user_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE "users" u
        SET current_portfolio = COALESCE(
            (SELECT portfolio_value 
             FROM investor_portfolio_performance 
             WHERE user_id = OLD.user_id 
             ORDER BY year DESC, month DESC 
             LIMIT 1),
            u.initial_capital
        ),
        updated_at = CURRENT_TIMESTAMP
        WHERE id = OLD.user_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to synchronize portfolio on performance changes
CREATE TRIGGER trigger_sync_portfolio_on_change
AFTER INSERT OR UPDATE OR DELETE ON investor_portfolio_performance
FOR EACH ROW EXECUTE FUNCTION sync_portfolio_value();

-- Apply updated_at triggers to all tables
CREATE TRIGGER trigger_update_timestamp_users BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trigger_update_timestamp_user_auth BEFORE UPDATE ON "user_auth" FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trigger_update_timestamp_investor_bank_details BEFORE UPDATE ON "investor_bank_details" FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trigger_update_timestamp_notifications BEFORE UPDATE ON "notifications" FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trigger_update_timestamp_fcm_tokens BEFORE UPDATE ON "fcm_tokens" FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trigger_update_timestamp_investor_portfolio_performance BEFORE UPDATE ON "investor_portfolio_performance" FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trigger_update_timestamp_admin_dashboard_stats BEFORE UPDATE ON "admin_dashboard_stats" FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trigger_update_timestamp_fund_performance BEFORE UPDATE ON "fund_performance" FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trigger_update_timestamp_capital_tranches BEFORE UPDATE ON "capital_tranches" FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trigger_update_timestamp_payment_schedules BEFORE UPDATE ON "payment_schedules" FOR EACH ROW EXECUTE FUNCTION update_timestamp();
