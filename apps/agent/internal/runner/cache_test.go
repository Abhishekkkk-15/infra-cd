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

	// Create a symlink pointing to test.txt inside node_modules
	symlinkPath := filepath.Join(testDir, "link.txt")
	errSym := os.Symlink("test.txt", symlinkPath)
	symlinkTested := true
	if errSym != nil {
		t.Logf("Failed to create symlink (possibly Windows privilege issue): %v. Symlink test will be skipped.", errSym)
		symlinkTested = false
	}

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

	if symlinkTested {
		// Verify symlink is restored and resolves correctly
		linkContent, err := os.ReadFile(filepath.Join(workDir2, "node_modules", "link.txt"))
		if err != nil {
			t.Fatalf("Failed to read restored symlink: %v", err)
		}
		if string(linkContent) != "hello world" {
			t.Fatalf("Restored symlink content mismatch: %s", string(linkContent))
		}

		fi, err := os.Lstat(filepath.Join(workDir2, "node_modules", "link.txt"))
		if err != nil {
			t.Fatalf("Failed to lstat restored symlink: %v", err)
		}
		if fi.Mode()&os.ModeSymlink == 0 {
			t.Fatalf("Restored file is not a symlink")
		}
	}
}
