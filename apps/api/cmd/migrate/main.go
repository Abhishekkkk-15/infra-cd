package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log"

	"github.com/abhishekkkk-15/infra-cd/api/internal/config"
	dbpkg "github.com/abhishekkkk-15/infra-cd/api/internal/db"
	"github.com/abhishekkkk-15/infra-cd/api/internal/db/models"
)

func main() {
	cfg := config.LoadFromEnv()

	if _, err := dbpkg.Open(context.Background(), &cfg.DB); err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer func() {
		if err := dbpkg.Close(); err != nil {
			log.Printf("failed to close db: %v", err)
		}
	}()

	if err := dbpkg.AutoMigrate(&models.User{}, &models.PersonalToken{}, &models.Agent{}, &models.Deployment{}, &models.DeploymentLog{}, &models.DeploymentStep{}, &models.Webhook{}, &models.Project{}, &models.EnvironmentVariable{}); err != nil {
		log.Fatalf("failed to run migrations: %v", err)
	}

	// Backfill deploy tokens for existing projects
	var projects []models.Project
	if err := dbpkg.DB.Where("deploy_token = ? OR deploy_token IS NULL", "").Find(&projects).Error; err != nil {
		log.Printf("warning: failed to query projects with empty deploy token: %v", err)
	} else {
		for _, p := range projects {
			bytes := make([]byte, 24)
			if _, err := rand.Read(bytes); err != nil {
				log.Printf("warning: failed to generate token for project %s: %v", p.ID, err)
				continue
			}
			token := "icd_proj_" + hex.EncodeToString(bytes)
			if err := dbpkg.DB.Model(&p).Update("deploy_token", token).Error; err != nil {
				log.Printf("warning: failed to update deploy token for project %s: %v", p.ID, err)
			} else {
				log.Printf("successfully backfilled deploy token for project %s (%s)", p.Name, p.ID)
			}
		}
	}

	log.Println("migrations completed successfully")
}
