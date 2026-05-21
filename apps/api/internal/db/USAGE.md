# Database (GORM) usage

This package provides a GORM-based PostgreSQL connection helper.

Basic usage:

```go
import (
    "context"
    "github.com/abhishekkkk-15/infra-cd/api/internal/db"
    "github.com/abhishekkkk-15/infra-cd/api/internal/db/models"
)

func main() {
    ctx := context.Background()
    cfg := db.FromEnv() // or build custom cfg
    _, err := db.Open(ctx, cfg)
    if err != nil {
        panic(err)
    }
    defer db.Close()

    // Run automigrations for your models
    if err := db.AutoMigrate(&models.User{}); err != nil {
        panic(err)
    }
}
```

Environment variables (defaults shown):

- `DATABASE_URL` - Full Postgres DSN (takes precedence)
- `DB_HOST` - default `localhost`
- `DB_PORT` - default `5432`
- `DB_USER` - default `postgres`
- `DB_PASSWORD` - no default
- `DB_NAME` - default `infra_cd`
- `DB_SSLMODE` - default `disable`
- `DB_MAX_OPEN_CONNS`, `DB_MAX_IDLE_CONNS`, `DB_CONN_MAX_LIFETIME_SEC`

