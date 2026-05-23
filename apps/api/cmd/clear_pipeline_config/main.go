package main

import (
	"context"
	"log"

	dbpkg "github.com/abhishekkkk-15/infra-cd/api/internal/db"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()
	cfg := dbpkg.FromEnv()
	db, err := dbpkg.Open(context.Background(), cfg)
	if err != nil {
		log.Fatalf("failed to open db: %v", err)
	}
	defer dbpkg.Close()

	if err := db.Exec("UPDATE projects SET pipeline_config = ''").Error; err != nil {
		log.Fatalf("failed to update projects: %v", err)
	}

	log.Println("Successfully cleared pipeline_config for all projects.")
}
