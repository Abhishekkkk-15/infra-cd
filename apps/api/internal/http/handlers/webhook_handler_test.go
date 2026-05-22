package handlers

import (
	"testing"
)

func TestMatchesPath(t *testing.T) {
	tests := []struct {
		filePath   string
		filterPath string
		expected   bool
	}{
		{"frontend/package.json", "frontend", true},
		{"frontend/package.json", "frontend/", true},
		{"frontend/package.json", "frontend/package.json", true},
		{"backend/package.json", "frontend", false},
		{"frontend/src/index.js", "frontend", true},
		{"frontend/src/index.js", "frontend/src", true},
		{"frontend/src/index.js", "frontend/src/index.js", true},
		{"frontend/src/index.js", "frontend/src/", true},
		{"frontend/src/index.js", "", true}, // empty filter matches everything
	}

	for _, tt := range tests {
		t.Run(tt.filePath+"__"+tt.filterPath, func(t *testing.T) {
			actual := matchesPath(tt.filePath, tt.filterPath)
			if actual != tt.expected {
				t.Errorf("matchesPath(%q, %q) = %v; want %v", tt.filePath, tt.filterPath, actual, tt.expected)
			}
		})
	}
}
