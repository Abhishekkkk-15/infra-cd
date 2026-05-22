package runner

import (
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
