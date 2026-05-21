package db

import (
    "fmt"
    "os"
    "strconv"
)

// Config holds Postgres connection settings.
type Config struct {
    DSN               string
    Host              string
    Port              string
    User              string
    Password          string
    DBName            string
    SSLMode           string
    MaxOpenConns      int
    MaxIdleConns      int
    ConnMaxLifetimeSec int
}

// FromEnv builds a Config from environment variables. If `DATABASE_URL` is set,
// it will be used as the DSN. Otherwise individual settings are read.
func FromEnv() *Config {
    c := &Config{
        DSN:     os.Getenv("DATABASE_URL"),
        Host:    getenvDefault("DB_HOST", "localhost"),
        Port:    getenvDefault("DB_PORT", "5432"),
        User:    getenvDefault("DB_USER", "postgres"),
        Password: os.Getenv("DB_PASSWORD"),
        DBName:  getenvDefault("DB_NAME", "infra_cd"),
        SSLMode: getenvDefault("DB_SSLMODE", "disable"),
        MaxOpenConns: parseEnvInt("DB_MAX_OPEN_CONNS", 25),
        MaxIdleConns: parseEnvInt("DB_MAX_IDLE_CONNS", 25),
        ConnMaxLifetimeSec: parseEnvInt("DB_CONN_MAX_LIFETIME_SEC", 300),
    }

    if c.DSN == "" {
        c.DSN = fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
            c.Host, c.Port, c.User, c.Password, c.DBName, c.SSLMode)
    }

    return c
}

func getenvDefault(k, d string) string {
    v := os.Getenv(k)
    if v == "" {
        return d
    }
    return v
}

func parseEnvInt(k string, d int) int {
    s := os.Getenv(k)
    if s == "" {
        return d
    }
    if v, err := strconv.Atoi(s); err == nil {
        return v
    }
    return d
}
