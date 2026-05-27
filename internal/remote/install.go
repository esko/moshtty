package remote

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"text/template"
	"time"

	"github.com/moshtty/moshtty/internal/certs"
	"github.com/moshtty/moshtty/internal/config"
)

type InstallOptions struct {
	Paths      config.Paths
	BinaryPath string
	ForcePlist bool
}

type InstallResult struct {
	ConfigPath      string
	TokenPath       string
	LaunchAgentPath string
	UserBinDir      string
}

func Install(opts InstallOptions) (InstallResult, error) {
	if runtime.GOOS != "darwin" && runtime.GOOS != "linux" {
		return InstallResult{}, fmt.Errorf("install is supported on macOS and Linux only")
	}
	if opts.BinaryPath == "" {
		return InstallResult{}, fmt.Errorf("binary path is required")
	}

	paths := opts.Paths
	dirs := []string{
		paths.ApplicationSupportDir(),
		paths.CertsDir(),
		paths.LogsDir(),
		paths.UserServiceDir(),
	}
	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return InstallResult{}, fmt.Errorf("create dir %s: %w", dir, err)
		}
	}

	_, _, err := ensureRuntimeAssets(paths)
	if err != nil {
		return InstallResult{}, err
	}

	servicePath := paths.UserServicePath()
	if _, err := os.Stat(servicePath); err == nil && !opts.ForcePlist {
		if runtime.GOOS == "darwin" {
			return InstallResult{}, fmt.Errorf("launch agent already exists at %s", servicePath)
		} else {
			return InstallResult{}, fmt.Errorf("systemd service already exists at %s", servicePath)
		}
	}

	var serviceBytes []byte
	if runtime.GOOS == "darwin" {
		serviceBytes, err = RenderLaunchAgent(LaunchAgentInput{
			Label:      config.LaunchAgentLabel,
			BinaryPath: opts.BinaryPath,
			WorkingDir: paths.ApplicationSupportDir(),
			StdOutPath: paths.StdOutLogPath(),
			StdErrPath: paths.StdErrLogPath(),
		})
	} else {
		serviceBytes, err = RenderSystemdService(LaunchAgentInput{
			Label:      config.LaunchAgentLabel,
			BinaryPath: opts.BinaryPath,
			WorkingDir: paths.ApplicationSupportDir(),
			StdOutPath: paths.StdOutLogPath(),
			StdErrPath: paths.StdErrLogPath(),
		})
	}
	if err != nil {
		return InstallResult{}, err
	}

	if err := os.WriteFile(servicePath, serviceBytes, 0o644); err != nil {
		if runtime.GOOS == "darwin" {
			return InstallResult{}, fmt.Errorf("write launch agent: %w", err)
		} else {
			return InstallResult{}, fmt.Errorf("write systemd service: %w", err)
		}
	}

	return InstallResult{
		ConfigPath:      paths.ConfigPath(),
		TokenPath:       paths.TokenPath(),
		LaunchAgentPath: servicePath,
		UserBinDir:      paths.UserBinDir(),
	}, nil
}

func LoadLaunchAgent(plistPath string) error {
	if runtime.GOOS != "darwin" {
		return fmt.Errorf("launchctl is supported on macOS only")
	}
	cmd := exec.Command("launchctl", "load", "-w", plistPath)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("launchctl load: %w: %s", err, bytes.TrimSpace(out))
	}
	return nil
}

func UnloadLaunchAgent(plistPath string) error {
	if runtime.GOOS != "darwin" {
		return fmt.Errorf("launchctl is supported on macOS only")
	}
	cmd := exec.Command("launchctl", "unload", "-w", plistPath)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("launchctl unload: %w: %s", err, bytes.TrimSpace(out))
	}
	return nil
}

func ensureRuntimeAssets(paths config.Paths) (config.Config, string, error) {
	cfgPath := paths.ConfigPath()
	var cfg config.Config
	if _, err := os.Stat(cfgPath); os.IsNotExist(err) {
		remoteID, err := config.GenerateToken()
		if err != nil {
			return config.Config{}, "", err
		}
		cfg = config.DefaultConfig(remoteID)
		cfg.Cert.CurrentPath = paths.CurrentCertPath()
		cfg.Cert.NextPath = paths.NextCertPath()
		if err := config.Save(cfgPath, cfg); err != nil {
			return config.Config{}, "", err
		}
	} else if err != nil {
		return config.Config{}, "", err
	} else {
		cfg, err = config.Load(cfgPath)
		if err != nil {
			return config.Config{}, "", err
		}
	}

	tokenPath := paths.TokenPath()
	token, err := config.LoadToken(tokenPath)
	if err != nil {
		if !os.IsNotExist(err) {
			return config.Config{}, "", err
		}
		token, err = config.GenerateToken()
		if err != nil {
			return config.Config{}, "", err
		}
		if err := config.SaveToken(tokenPath, token); err != nil {
			return config.Config{}, "", err
		}
	}

	if err := ensureCertificates(paths, &cfg); err != nil {
		return config.Config{}, "", err
	}

	return cfg, token, nil
}

func ensureCertificates(paths config.Paths, cfg *config.Config) error {
	currentPath := paths.CurrentCertPath()
	nextPath := paths.NextCertPath()

	if _, statErr := os.Stat(currentPath); os.IsNotExist(statErr) {
		if err := rotateCertificates(paths, cfg); err != nil {
			return err
		}
		return config.Save(paths.ConfigPath(), *cfg)
	} else if statErr != nil {
		return statErr
	}

	// Check if current cert is expired or expiring in < 24 hours
	currentTLSCert, err := certs.LoadTLSCertificate(currentPath)
	needsRotation := false
	if err != nil {
		needsRotation = true
	} else if currentTLSCert.Leaf == nil || time.Now().UTC().Add(24*time.Hour).After(currentTLSCert.Leaf.NotAfter) {
		needsRotation = true
	}

	if needsRotation {
		if err := rotateAndPromoteCertificates(paths, cfg); err != nil {
			return err
		}
	} else {
		currentHash, err := configCertHash(currentPath)
		if err != nil {
			return err
		}
		cfg.Cert.CurrentPath = currentPath
		cfg.Cert.CurrentHash = currentHash
		cfg.Cert.NotAfter = currentTLSCert.Leaf.NotAfter

		if _, err := os.Stat(nextPath); os.IsNotExist(err) {
			if _, err := generateAndSave(nextPath); err != nil {
				return err
			}
		}

		nextHash, hashErr := configCertHash(nextPath)
		if hashErr != nil {
			return hashErr
		}
		nextTLSCert, loadErr := certs.LoadTLSCertificate(nextPath)
		if loadErr == nil && nextTLSCert.Leaf != nil {
			cfg.Cert.NextPath = nextPath
			cfg.Cert.NextHash = nextHash
			cfg.Cert.NextNotAfter = nextTLSCert.Leaf.NotAfter
		}
	}

	return config.Save(paths.ConfigPath(), *cfg)
}

func rotateAndPromoteCertificates(paths config.Paths, cfg *config.Config) error {
	nextPath := paths.NextCertPath()
	currentPath := paths.CurrentCertPath()

	var nextValid bool
	if nextTLSCert, err := certs.LoadTLSCertificate(nextPath); err == nil {
		if nextTLSCert.Leaf != nil && time.Now().UTC().Add(24*time.Hour).Before(nextTLSCert.Leaf.NotAfter) {
			nextValid = true
		}
	}

	if nextValid {
		// Promote next to current
		if err := os.Rename(nextPath, currentPath); err != nil {
			return fmt.Errorf("failed to promote next cert: %w", err)
		}
	} else {
		// Generate new current
		if _, err := generateAndSave(currentPath); err != nil {
			return fmt.Errorf("failed to generate current cert: %w", err)
		}
	}

	// Generate new next
	if _, err := generateAndSave(nextPath); err != nil {
		return fmt.Errorf("failed to generate next cert: %w", err)
	}

	currentHash, err := configCertHash(currentPath)
	if err != nil {
		return err
	}
	currentTLS, err := certs.LoadTLSCertificate(currentPath)
	if err != nil {
		return err
	}

	nextHash, err := configCertHash(nextPath)
	if err != nil {
		return err
	}
	nextTLS, err := certs.LoadTLSCertificate(nextPath)
	if err != nil {
		return err
	}

	cfg.Cert.CurrentPath = currentPath
	cfg.Cert.CurrentHash = currentHash
	cfg.Cert.NotAfter = currentTLS.Leaf.NotAfter

	cfg.Cert.NextPath = nextPath
	cfg.Cert.NextHash = nextHash
	cfg.Cert.NextNotAfter = nextTLS.Leaf.NotAfter

	return nil
}

func rotateCertificates(paths config.Paths, cfg *config.Config) error {
	current, err := generateAndSave(paths.CurrentCertPath())
	if err != nil {
		return err
	}
	next, err := generateAndSave(paths.NextCertPath())
	if err != nil {
		return err
	}

	cfg.Cert.CurrentPath = paths.CurrentCertPath()
	cfg.Cert.NextPath = paths.NextCertPath()
	cfg.Cert.CurrentHash = current.Hash
	cfg.Cert.NextHash = next.Hash
	cfg.Cert.NotAfter = current.NotAfter
	cfg.Cert.NextNotAfter = next.NotAfter
	return nil
}

type LaunchAgentInput struct {
	Label      string
	BinaryPath string
	WorkingDir string
	StdOutPath string
	StdErrPath string
}

var launchAgentTemplate = template.Must(template.New("launchagent").Parse(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>{{ .Label }}</string>
  <key>ProgramArguments</key>
  <array>
    <string>{{ .BinaryPath }}</string>
    <string>run</string>
  </array>
  <key>WorkingDirectory</key>
  <string>{{ .WorkingDir }}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>{{ .StdOutPath }}</string>
  <key>StandardErrorPath</key>
  <string>{{ .StdErrPath }}</string>
</dict>
</plist>
`))

func RenderLaunchAgent(input LaunchAgentInput) ([]byte, error) {
	var buf bytes.Buffer
	if err := launchAgentTemplate.Execute(&buf, input); err != nil {
		return nil, fmt.Errorf("render launch agent: %w", err)
	}
	return buf.Bytes(), nil
}

var systemdServiceTemplate = template.Must(template.New("systemdservice").Parse(`[Unit]
Description=Moshtty Remote Companion
After=network.target

[Service]
Type=simple
ExecStart={{ .BinaryPath }} run
WorkingDirectory={{ .WorkingDir }}
Restart=always
RestartSec=5
StandardOutput=append:{{ .StdOutPath }}
StandardError=append:{{ .StdErrPath }}

[Install]
WantedBy=default.target
`))

func RenderSystemdService(input LaunchAgentInput) ([]byte, error) {
	var buf bytes.Buffer
	if err := systemdServiceTemplate.Execute(&buf, input); err != nil {
		return nil, fmt.Errorf("render systemd service: %w", err)
	}
	return buf.Bytes(), nil
}

func ResolveBinaryPath(explicit string) (string, error) {
	if explicit != "" {
		return filepath.Abs(explicit)
	}
	path, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("resolve executable: %w", err)
	}
	return filepath.Abs(path)
}
