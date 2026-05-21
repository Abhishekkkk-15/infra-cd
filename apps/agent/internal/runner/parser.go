package runner

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

type PipelineConfig struct {
	Version string `yaml:"version"`
	Jobs    []Job  `yaml:"jobs"`
}

type Job struct {
	Name   string `yaml:"name"`
	Script string `yaml:"script"`
}

// ParsePipelineConfig reads and unmarshals the .infra-cd.yaml file
func ParsePipelineConfig(filePath string) (*PipelineConfig, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read pipeline config: %w", err)
	}

	var config PipelineConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse pipeline config: %w", err)
	}

	return &config, nil
}
