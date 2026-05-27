package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/abhishekkkk-15/infra-cd/cli/internal/client"
	"github.com/spf13/cobra"
)

var projectsCmd = &cobra.Command{
	Use:   "projects",
	Short: "Manage projects",
}

var projectsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all projects",
	Run: func(cmd *cobra.Command, args []string) {
		body, err := client.DoRequest("GET", "/api/v1/projects", nil)
		if err != nil {
			fmt.Println(err)
			os.Exit(1)
		}

		var projects []struct {
			ID          string `json:"id"`
			Name        string `json:"name"`
			RepoURL     string `json:"repo_url"`
			Branch      string `json:"branch"`
		}
		if err := json.Unmarshal(body, &projects); err != nil {
			fmt.Printf("Failed to parse response: %v\n", err)
			os.Exit(1)
		}

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 3, ' ', 0)
		fmt.Fprintln(w, "ID\tNAME\tREPO\tBRANCH")
		for _, p := range projects {
			fmt.Fprintf(w, "%s\t%s\t%s\t%s\n", p.ID, p.Name, p.RepoURL, p.Branch)
		}
		w.Flush()
	},
}

func init() {
	rootCmd.AddCommand(projectsCmd)
	projectsCmd.AddCommand(projectsListCmd)
}
