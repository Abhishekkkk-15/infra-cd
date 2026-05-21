package models

import (
	"github.com/google/uuid"
)

// User is an example model to demonstrate migrations.
type User struct {
	ID uuid.UUID `gorm:"primaryKey;type:uuid; default:gen_random_uuid()"`

	Name     string `gorm:"size:255;not null" json:"name"`
	Email    string `gorm:"size:255;uniqueIndex;not null" `
	Password string `json:"-"`
	BaseModel
	Projects []Project
}
