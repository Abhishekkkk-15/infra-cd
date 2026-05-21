package models

import "github.com/google/uuid"

type Project struct {
	ID          uuid.UUID `gorm:"typeLuuid;default:gen_random_uuid();primaryKey"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	RepoURL     string    `json:"repo_url"`
	Branch      string    `json:"branch"`
	Buildpa
}
