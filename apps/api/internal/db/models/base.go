package models

import "time"

type BaseModel struct {
	CreatedAT time.Time
	UpdatedAt time.Time
}
