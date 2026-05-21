package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// Open establishes a connection to Postgres using the given config and sets
// sensible connection pool settings. It assigns the opened *gorm.DB to the
// package-level `DB` variable.
func Open(ctx context.Context, cfg *Config) (*gorm.DB, error) {
	if cfg == nil {
		cfg = FromEnv()
	}

	gormConfig := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	}

	dialector := postgres.Open(cfg.DSN)

	db, err := gorm.Open(dialector, gormConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to open gorm db: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get sql DB from gorm: %w", err)
	}

	// Apply connection pool settings
	sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)
	sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
	sqlDB.SetConnMaxLifetime(time.Duration(cfg.ConnMaxLifetimeSec) * time.Second)

	// Ping with context to verify connectivity
	if err := pingWithContext(sqlDB, ctx); err != nil {
		return nil, fmt.Errorf("database ping failed: %w", err)
	}

	DB = db
	return DB, nil
}

func pingWithContext(sqlDB *sql.DB, ctx context.Context) error {
	// Use PingContext when available
	if ctx == nil {
		ctx = context.Background()
	}
	return sqlDB.PingContext(ctx)
}

// Close closes the underlying database connection.
func Close() error {
	if DB == nil {
		return nil
	}
	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
