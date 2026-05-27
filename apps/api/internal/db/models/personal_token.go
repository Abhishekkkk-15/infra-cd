package models

import (
	"time"

	"github.com/google/uuid"
)

type PersonalToken struct {
	ID          uuid.UUID  `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	Name        string     `gorm:"size:255;not null" json:"name"`
	TokenHash   string     `gorm:"size:255;not null;uniqueIndex" json:"-"`
	LastUsedAt  *time.Time `json:"last_used_at"`
	ExpiresAt   *time.Time `json:"expires_at"`
	UserID      uuid.UUID  `gorm:"type:uuid;not null" json:"user_id"`
	BaseModel
}
