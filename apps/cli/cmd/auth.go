package cmd

import (
	"context"
	"fmt"
	"net/http"
	"os"

	"github.com/pkg/browser"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var withToken string
var webUrl string

var authCmd = &cobra.Command{
	Use:   "auth",
	Short: "Authenticate infra-cd CLI",
}

var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "Authenticate with your infra-cd account",
	Run: func(cmd *cobra.Command, args []string) {
		if withToken != "" {
			saveToken(withToken)
			fmt.Println("✓ Successfully authenticated with provided token.")
			return
		}

		// Web Browser flow
		port := "8085"
		loginURL := fmt.Sprintf("%s/cli-auth?port=%s", webUrl, port)

		fmt.Println("Opening browser to authenticate...")
		fmt.Printf("If the browser doesn't open, visit: %s\n", loginURL)

		if err := browser.OpenURL(loginURL); err != nil {
			fmt.Printf("Failed to open browser: %v\n", err)
		}

		// Start local server to receive token
		m := http.NewServeMux()
		srv := &http.Server{Addr: ":" + port, Handler: m}

		done := make(chan bool)

		m.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
			token := r.URL.Query().Get("token")
			if token == "" {
				fmt.Fprintln(w, "Failed to authenticate: no token received.")
				fmt.Println("✗ Authentication failed: no token received.")
				done <- false
				return
			}

			saveToken(token)
			fmt.Fprintln(w, "Authentication successful! You can close this window.")
			fmt.Println("✓ Successfully authenticated via web browser.")
			done <- true
		})

		go func() {
			if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				fmt.Printf("Error starting local server: %v\n", err)
				done <- false
			}
		}()

		success := <-done
		srv.Shutdown(context.Background())

		if !success {
			os.Exit(1)
		}
	},
}

func saveToken(token string) {
	viper.Set("token", token)
	err := viper.WriteConfig()
	if err != nil {
		fmt.Printf("Failed to save config: %v\n", err)
	}
}

func init() {
	rootCmd.AddCommand(authCmd)
	authCmd.AddCommand(loginCmd)

	loginCmd.Flags().StringVar(&withToken, "with-token", "", "Authenticate with a personal access token")
	loginCmd.Flags().StringVar(&webUrl, "web-url", "http://localhost:5173", "infra-cd Web UI URL")
}
