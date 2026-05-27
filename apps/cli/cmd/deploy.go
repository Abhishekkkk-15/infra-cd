package cmd

import (
	"fmt"
	"os"

	"github.com/abhishekkkk-15/infra-cd/cli/internal/client"
	"github.com/spf13/cobra"
)

var deployCmd = &cobra.Command{
	Use:   "deploy [project-id]",
	Short: "Trigger a manual deployment for a project",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		projectID := args[0]
		
		body, err := client.DoRequest("POST", fmt.Sprintf("/api/v1/projects/%s/deployments", projectID), nil)
		if err != nil {
			fmt.Printf("Failed to trigger deployment: %v\n", err)
			os.Exit(1)
		}

		fmt.Println("✓ Deployment triggered successfully!")
		fmt.Printf("Response: %s\n", string(body))
	},
}

func init() {
	rootCmd.AddCommand(deployCmd)
}
