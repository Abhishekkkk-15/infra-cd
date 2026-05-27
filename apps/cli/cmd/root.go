package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var rootCmd = &cobra.Command{
	Use:   "infra-cd",
	Short: "infra-cd CLI to manage your decentralized CI/CD orchestrator",
	Long:  `infra-cd CLI provides a terminal interface to interact with your infra-cd instance.`,
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func init() {
	cobra.OnInitialize(initConfig)

	rootCmd.PersistentFlags().String("api-url", "http://localhost:8080", "infra-cd API URL")
	rootCmd.PersistentFlags().String("token", "", "infra-cd API Token")
	
	viper.BindPFlag("api-url", rootCmd.PersistentFlags().Lookup("api-url"))
	viper.BindPFlag("token", rootCmd.PersistentFlags().Lookup("token"))
}

func initConfig() {
	home, err := os.UserHomeDir()
	cobra.CheckErr(err)

	configDir := filepath.Join(home, ".infra-cd")
	
	// Create directory if it doesn't exist
	if _, err := os.Stat(configDir); os.IsNotExist(err) {
		os.MkdirAll(configDir, 0755)
	}

	viper.AddConfigPath(configDir)
	viper.SetConfigType("yaml")
	viper.SetConfigName("config")

	viper.AutomaticEnv()
	viper.SetEnvPrefix("INFRA")

	// If a config file is found, read it in.
	if err := viper.ReadInConfig(); err == nil {
		// Config loaded
	} else {
		// Create empty config file if it doesn't exist
		if _, err := os.Stat(filepath.Join(configDir, "config.yaml")); os.IsNotExist(err) {
			viper.WriteConfigAs(filepath.Join(configDir, "config.yaml"))
		}
	}
}
