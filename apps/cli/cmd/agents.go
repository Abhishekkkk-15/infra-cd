package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/abhishekkkk-15/infra-cd/cli/internal/client"
	"github.com/spf13/cobra"
)

var agentsCmd = &cobra.Command{
	Use:   "agents",
	Short: "Manage runner agents",
}

var agentsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all registered agents",
	Run: func(cmd *cobra.Command, args []string) {
		body, err := client.DoRequest("GET", "/api/v1/agents", nil)
		if err != nil {
			fmt.Println(err)
			os.Exit(1)
		}

		var agents []struct {
			ID       string `json:"id"`
			Name     string `json:"name"`
			Status   string `json:"status"`
			Hostname string `json:"hostname"`
		}
		if err := json.Unmarshal(body, &agents); err != nil {
			fmt.Printf("Failed to parse response: %v\n", err)
			os.Exit(1)
		}

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 3, ' ', 0)
		fmt.Fprintln(w, "ID\tNAME\tSTATUS\tHOSTNAME")
		for _, a := range agents {
			fmt.Fprintf(w, "%s\t%s\t%s\t%s\n", a.ID, a.Name, a.Status, a.Hostname)
		}
		w.Flush()
	},
}

func init() {
	rootCmd.AddCommand(agentsCmd)
	agentsCmd.AddCommand(agentsListCmd)
}
