package config

import (
	"os"
	"strconv"
	"time"

	"github.com/abhishekkkk-15/infra-cd/api/internal/db"
	"github.com/joho/godotenv"
)

// Config holds application-level configuration loaded from environment variables.
type Config struct {
	// Server
	Port         string        // HTTP listen port (e.g. "8080")
	ReadTimeout  time.Duration // server read timeout
	WriteTimeout time.Duration // server write timeout

	// App environment
	Env      string // e.g. "development" or "production"
	LogLevel string // e.g. "debug", "info"

	// Database config (delegated to internal/db.Config)
	DB db.Config
}

// LoadFromEnv loads configuration from environment variables with sensible defaults.
func LoadFromEnv() *Config {
	// Load .env if present so environment variables are available to the app.
	_ = godotenv.Load()

	cfg := &Config{
		Port:         getenvDefault("PORT", "8080"),
		ReadTimeout:  time.Duration(parseEnvInt("SERVER_READ_TIMEOUT_SEC", 5)) * time.Second,
		WriteTimeout: time.Duration(parseEnvInt("SERVER_WRITE_TIMEOUT_SEC", 10)) * time.Second,
		Env:          getenvDefault("APP_ENV", "development"),
		LogLevel:     getenvDefault("LOG_LEVEL", "info"),
		DB:           *db.FromEnv(),
	}

	// Allow overriding port with numeric environment var
	if p := os.Getenv("PORT"); p != "" {
		cfg.Port = p
	}

	return cfg
}

func getenvDefault(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

func parseEnvInt(k string, d int) int {
	if s := os.Getenv(k); s != "" {
		if v, err := strconv.Atoi(s); err == nil {
			return v
		}
	}
	return d
}
