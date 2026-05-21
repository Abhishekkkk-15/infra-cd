package runner

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCaching(t *testing.T) {
	workDir, _ := os.MkdirTemp("", "cache-test-")
	defer os.RemoveAll(workDir)

	testDir := filepath.Join(workDir, "node_modules")
	os.MkdirAll(testDir, 0755)
	os.WriteFile(filepath.Join(testDir, "test.txt"), []byte("hello world"), 0644)

	projectID := "test-project-123"

	err := saveCache(projectID, workDir, []string{"node_modules"})
	if err != nil {
		t.Fatalf("Save error: %v", err)
	}

	workDir2, _ := os.MkdirTemp("", "cache-test2-")
	defer os.RemoveAll(workDir2)

	err = extractCache(projectID, workDir2)
	if err != nil {
		t.Fatalf("Extract error: %v", err)
	}

	content, err := os.ReadFile(filepath.Join(workDir2, "node_modules", "test.txt"))
	if err != nil {
		t.Fatalf("Verify error: %v", err)
	}

	if string(content) != "hello world" {
		t.Fatalf("Content mismatch: %s", string(content))
	}
}
