package main

import (
	"context"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	dbpkg "github.com/abhishekkkk-15/infra-cd/api/internal/db"
	"github.com/abhishekkkk-15/infra-cd/api/internal/http/handlers"
	"github.com/abhishekkkk-15/infra-cd/api/internal/http/middleware"
	agentsvc "github.com/abhishekkkk-15/infra-cd/api/internal/http/services"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file first so all env vars are available
	_ = godotenv.Load()

	// ── Database ─────────────────────────────────────────────────────────────
	ctx := context.Background()
	cfg := dbpkg.FromEnv()
	if _, err := dbpkg.Open(ctx, cfg); err != nil {
		log.Fatalf("failed to open db: %v", err)
	}
	defer func() {
		if err := dbpkg.Close(); err != nil {
			log.Printf("error closing db: %v", err)
		}
	}()

	// Auto-migrate all models
	// if err := dbpkg.AutoMigrate(
	// 	&models.User{},
	// 	&models.Agent{},
	// 	&models.Project{},
	// 	&models.EnvironmentVariable{},
	// 	&models.Webhook{},
	// 	&models.Deployment{},
	// 	&models.DeploymentStep{},
	// 	&models.DeploymentLog{},
	// ); err != nil {
	// 	log.Fatalf("failed to auto-migrate: %v", err)
	// }

	// Seed Auth
	if err := agentsvc.InitAuth(); err != nil {
		log.Fatalf("failed to init auth: %v", err)
	}

	// ── Background: mark stale agents offline every 30s ──────────────────────
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			if err := agentsvc.MarkStaleAgentsOffline(); err != nil {
				slog.Error("failed to mark stale agents", "error", err)
			}
		}
	}()

	// ── Router ────────────────────────────────────────────────────────────────
	if os.Getenv("APP_ENV") == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Recovery(), gin.Logger())

	// CORS middleware
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization, X-Agent-Token")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	// ── Health ────────────────────────────────────────────────────────────────
	r.GET("/health", func(c *gin.Context) {
		sqlDB, err := dbpkg.DB.DB()
		dbStatus := "ok"
		if err != nil || sqlDB.Ping() != nil {
			dbStatus = "unreachable"
		}
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
			"db":     dbStatus,
		})
	})

	// ── Public webhook receivers ──────────────────────────────────────────────
	r.POST("/webhooks/github", handlers.GithubWebhook)

	// ── API v1 ────────────────────────────────────────────────────────────────
	api := r.Group("/api/v1")

	// Auth (public)
	auth := api.Group("/auth")
	{
		auth.POST("/login", handlers.Login)
		auth.POST("/register", handlers.Register)
	}

	// Protected UI Group
	ui := r.Group("/api/v1")
	ui.Use(middleware.RequireAuth())

	// Projects
	projects := ui.Group("/projects")
	{
		projects.GET("", handlers.GetProjects)
		projects.POST("", handlers.CreateProject)
		projects.GET("/:id", handlers.GetProjectByID)
		projects.PUT("/:id", handlers.UpdateProject)
		projects.DELETE("/:id", handlers.DeleteProject)

		// Env vars (nested under project)
		projects.GET("/:id/env", handlers.ListEnvVars)
		projects.POST("/:id/env", handlers.CreateEnvVar)
		projects.DELETE("/:id/env/:envId", handlers.DeleteEnvVar)

		// Webhooks (nested under project)
		projects.GET("/:id/webhooks", handlers.ListWebhooks)
		projects.POST("/:id/webhooks", handlers.CreateWebhook)
		projects.DELETE("/:id/webhooks/:webhookId", handlers.DeleteWebhook)

		// Deployments (nested under project)
		projects.GET("/:id/deployments", handlers.ListDeployments)
		projects.POST("/:id/deployments", handlers.TriggerDeployment)
	}

	// Deployments (top-level for detail + agent callbacks)
	deployments := api.Group("/deployments")
	{
		ui.GET("/deployments/:id", handlers.GetDeployment)
		// UI stream logs uses EventSource which doesn't easily send auth headers natively unless modified,
		// but since we want to protect it, we should map it onto `ui` and the frontend needs to handle it or we can leave it public.
		// For simplicity, we'll map stream to `ui` and see if EventSource works with cookies/tokens in URL,
		// but since EventSource doesn't do Bearer headers easily, we'll leave it in `api` (unprotected) or use query token.
		// Let's protect GetDeployment but leave stream unprotected for MVP.
		api.GET("/deployments/:id/logs/stream", handlers.StreamDeploymentLogs)

		// Agent-facing endpoints (use agent tokens, currently unprotected)
		deployments.PATCH("/:id/status", handlers.UpdateDeploymentStatus)
		deployments.PATCH("/:id/steps/:stepId", handlers.UpdateDeploymentStep)
		deployments.POST("/:id/logs", handlers.AppendDeploymentLog)
	}

	// Agents UI endpoints
	ui.GET("/agents", handlers.ListAgents)
	ui.POST("/agents", handlers.CreateAgent)
	ui.GET("/agents/:id", handlers.GetAgentByID)
	ui.DELETE("/agents/:id", handlers.DeleteAgent)

	// Agent-facing agent endpoints
	agents := api.Group("/agents")
	{
		agents.GET("/verify", handlers.VerifyAgent)
		agents.POST("/:id/heartbeat", handlers.Heartbeat)
		agents.GET("/:id/pending-deployments", handlers.GetPendingDeployments)
		agents.GET("/projects/:projectId/env", handlers.ListEnvVarsAgent)
	}

	// System metrics
	ui.GET("/system/metrics", handlers.GetSystemMetrics)
	ui.GET("/system/logs", handlers.GetSystemLogs)

	// ── Server ────────────────────────────────────────────────────────────────
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second, // longer for SSE streams
	}

	go func() {
		slog.Info("server starting", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	slog.Info("shutting down server...")

	ctxShutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctxShutdown); err != nil {
		log.Fatalf("server forced to shutdown: %v", err)
	}
	slog.Info("server stopped")
}
