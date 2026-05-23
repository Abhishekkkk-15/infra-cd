package runner

import (
	"os"
	"strings"
	"testing"
)

func TestMatchPathPattern(t *testing.T) {
	tests := []struct {
		pattern  string
		path     string
		expected bool
	}{
		// Exact match
		{"frontend/package.json", "frontend/package.json", true},
		// Prefix folder match
		{"frontend", "frontend/package.json", true},
		{"frontend/", "frontend/package.json", true},
		{"frontend", "frontend/src/index.js", true},
		// Non-matching
		{"frontend", "backend/package.json", false},
		{"frontend/package.json", "frontend/index.js", false},
		// Wildcard **
		{"frontend/**", "frontend/package.json", true},
		{"frontend/**", "frontend/src/index.js", true},
		{"frontend/**", "frontend/src/components/button.tsx", true},
		{"frontend/**", "backend/package.json", false},
		{"**/package.json", "frontend/package.json", true},
		{"**/package.json", "backend/package.json", true},
		{"**/package.json", "frontend/src/package.json", true},
		{"**/package.json", "frontend/index.js", false},
	}

	for _, tt := range tests {
		t.Run(tt.pattern+"__"+tt.path, func(t *testing.T) {
			actual := matchPathPattern(tt.pattern, tt.path)
			if actual != tt.expected {
				t.Errorf("matchPathPattern(%q, %q) = %v; want %v", tt.pattern, tt.path, actual, tt.expected)
			}
		})
	}
}

func TestShouldRunJob(t *testing.T) {
	tests := []struct {
		name         string
		job          Job
		changedFiles []string
		expected     bool
	}{
		{
			name: "no paths filter",
			job: Job{
				Name:  "build",
				Paths: []string{},
			},
			changedFiles: []string{"frontend/index.js"},
			expected:     true,
		},
		{
			name: "no changed files",
			job: Job{
				Name:  "build",
				Paths: []string{"frontend/**"},
			},
			changedFiles: []string{},
			expected:     true,
		},
		{
			name: "matching path",
			job: Job{
				Name:  "build",
				Paths: []string{"frontend/**"},
			},
			changedFiles: []string{"frontend/index.js", "backend/index.js"},
			expected:     true,
		},
		{
			name: "non-matching path",
			job: Job{
				Name:  "build",
				Paths: []string{"frontend/**"},
			},
			changedFiles: []string{"backend/index.js", "shared/utils.js"},
			expected:     false,
		},
		{
			name: "multiple patterns, one matches",
			job: Job{
				Name:  "build",
				Paths: []string{"frontend/**", "shared/**"},
			},
			changedFiles: []string{"shared/utils.js"},
			expected:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := shouldRunJob(tt.job, tt.changedFiles)
			if actual != tt.expected {
				t.Errorf("shouldRunJob() = %v; want %v", actual, tt.expected)
			}
		})
	}
}

func TestDockerRunScriptGeneration(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "runner-docker-test-")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	ctx := &ExecutionContext{
		Client:   nil, // client is nil, we check that it doesn't panic and uses fallback print
		DeployID: "test-deploy",
	}

	job := Job{
		Name:   "test-docker-job",
		Script: "echo 'hello world'",
		Image:  "alpine:latest",
	}

	// We expect runScript to try executing the "docker" command.
	// Whether docker is installed or not on the test machine, calling it will produce an error
	// (either file not found, or docker command failed, or connection refused).
	// We verify that the execution attempted to use "docker" and did not succeed silently on host.
	err = ctx.runScript(tempDir, job, []string{"ENV_VAR=test_value"})
	if err == nil {
		t.Fatal("expected error calling docker, but got nil")
	}

	errStr := err.Error()
	if !strings.Contains(strings.ToLower(errStr), "docker") && !strings.Contains(strings.ToLower(errStr), "exit status") {
		t.Errorf("expected error to mention 'docker' or 'exit status', but got: %s", errStr)
	}
}

