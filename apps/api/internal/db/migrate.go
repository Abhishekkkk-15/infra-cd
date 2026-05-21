package db

import (
    "fmt"
)

// AutoMigrate runs GORM automigrations for provided models. It requires an
// open database connection (DB).
func AutoMigrate(models ...interface{}) error {
    if DB == nil {
        return fmt.Errorf("database is not initialized; call Open first")
    }
    return DB.AutoMigrate(models...)
}
