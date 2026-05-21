package models

import (
    "time"
)

// User is an example model to demonstrate migrations.
type User struct {
    ID        uint      `gorm:"primaryKey"`
    CreatedAt time.Time
    UpdatedAt time.Time

    Name  string `gorm:"size:255;not null"`
    Email string `gorm:"size:255;uniqueIndex;not null"`
}
