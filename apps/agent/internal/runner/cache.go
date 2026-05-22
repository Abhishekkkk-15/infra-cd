package runner

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// extractCache extracts the project's cache zip into the workDir if it exists.
func extractCache(projectID, workDir string) error {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("failed to get user home directory: %w", err)
	}
	cacheDir := filepath.Join(homeDir, ".infracd_cache", projectID)
	cacheZip := filepath.Join(cacheDir, "cache.zip")

	if _, err := os.Stat(cacheZip); os.IsNotExist(err) {
		return nil // No cache exists yet
	}

	r, err := zip.OpenReader(cacheZip)
	if err != nil {
		return fmt.Errorf("failed to open cache zip: %w", err)
	}
	defer r.Close()

	for _, f := range r.File {
		fpath := filepath.Join(workDir, f.Name)
		if !strings.HasPrefix(fpath, filepath.Clean(workDir)+string(os.PathSeparator)) {
			continue // Zip slip vulnerability prevention
		}

		if f.FileInfo().IsDir() {
			os.MkdirAll(fpath, os.ModePerm)
			continue
		}

		if err = os.MkdirAll(filepath.Dir(fpath), os.ModePerm); err != nil {
			return err
		}

		// Handle symbolic link extraction
		if f.Mode()&os.ModeSymlink != 0 {
			rc, err := f.Open()
			if err != nil {
				return err
			}
			targetBytes, err := io.ReadAll(rc)
			rc.Close()
			if err != nil {
				return err
			}
			target := string(targetBytes)

			// Remove existing file/symlink if any
			if err := os.Remove(fpath); err != nil && !os.IsNotExist(err) {
				return err
			}

			if err := os.Symlink(target, fpath); err != nil {
				return fmt.Errorf("failed to create symlink: %w", err)
			}
			continue
		}

		outFile, err := os.OpenFile(fpath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			return err
		}

		rc, err := f.Open()
		if err != nil {
			outFile.Close()
			return err
		}

		_, err = io.Copy(outFile, rc)
		outFile.Close()
		rc.Close()
		if err != nil {
			return err
		}
	}

	return nil
}

// saveCache archives the configured paths from workDir into a cache zip.
func saveCache(projectID, workDir string, paths []string) error {
	if len(paths) == 0 {
		return nil
	}
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("failed to get user home directory: %w", err)
	}
	cacheDir := filepath.Join(homeDir, ".infracd_cache", projectID)
	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		return fmt.Errorf("failed to create cache dir: %w", err)
	}
	cacheZip := filepath.Join(cacheDir, "cache.zip")

	outFile, err := os.Create(cacheZip)
	if err != nil {
		return fmt.Errorf("failed to create cache zip: %w", err)
	}
	defer outFile.Close()

	w := zip.NewWriter(outFile)
	defer w.Close()

	for _, p := range paths {
		targetPath := filepath.Join(workDir, p)
		if _, err := os.Stat(targetPath); os.IsNotExist(err) {
			continue
		}

		err = filepath.Walk(targetPath, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}

			relPath, err := filepath.Rel(workDir, path)
			if err != nil {
				return err
			}
			relPath = filepath.ToSlash(relPath)

			if info.IsDir() {
				relPath += "/"
			}

			header, err := zip.FileInfoHeader(info)
			if err != nil {
				return err
			}
			header.Name = relPath

			if info.IsDir() {
				header.Method = zip.Store
				_, err = w.CreateHeader(header)
				return err
			}

			if info.Mode()&os.ModeSymlink != 0 {
				linkTarget, err := os.Readlink(path)
				if err != nil {
					return err
				}
				header.Method = zip.Store
				writer, err := w.CreateHeader(header)
				if err != nil {
					return err
				}
				_, err = writer.Write([]byte(filepath.ToSlash(linkTarget)))
				return err
			}

			header.Method = zip.Deflate
			writer, err := w.CreateHeader(header)
			if err != nil {
				return err
			}

			file, err := os.Open(path)
			if err != nil {
				return err
			}
			_, err = io.Copy(writer, file)
			file.Close()
			return err
		})
		if err != nil {
			return fmt.Errorf("failed to zip cache path %s: %w", p, err)
		}
	}
	return nil
}
