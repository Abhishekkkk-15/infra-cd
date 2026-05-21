package main

import (
	"context"
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

	if err := dbpkg.AutoMigrate(&models.User{}, &models.Agent{}, &models.Deployment{}, &models.DeploymentLog{}, &models.DeploymentStep{}, &models.Webhook{}, &models.Project{}, &models.EnvironmentVariable{}); err != nil {
		log.Fatalf("failed to run migrations: %v", err)
	}

	log.Println("migrations completed successfully")
}
