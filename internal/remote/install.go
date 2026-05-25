package remote

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"text/template"

	"github.com/moshtty/moshtty/internal/config"
)

type InstallOptions struct {
	Paths       config.Paths
	BinaryPath  string
	ForcePlist  bool
}

type InstallResult struct {
	ConfigPath      string
	TokenPath       string
	LaunchAgentPath string
	UserBinDir      string
}

func Install(opts InstallOptions) (InstallResult, error) {
	if runtime.GOOS != "darwin" {
		return InstallResult{}, fmt.Errorf("install is supported on macOS only")
	}
	if opts.BinaryPath == "" {
		return InstallResult{}, fmt.Errorf("binary path is required")
	}

	paths := opts.Paths
	dirs := []string{
		paths.ApplicationSupportDir(),
		paths.CertsDir(),
		paths.LogsDir(),
		paths.LaunchAgentsDir(),
	}
	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return InstallResult{}, fmt.Errorf("create dir %s: %w", dir, err)
		}
	}

	cfg, token, err := ensureRuntimeAssets(paths)
	if err != nil {
		return InstallResult{}, err
	}

	plistPath := paths.LaunchAgentPath()
	if _, err := os.Stat(plistPath); err == nil && !opts.ForcePlist {
		return InstallResult{}, fmt.Errorf("launch agent already exists at %s", plistPath)
	}

	plist, err := RenderLaunchAgent(LaunchAgentInput{
		Label:       config.LaunchAgentLabel,
		BinaryPath:  opts.BinaryPath,
		WorkingDir:  paths.ApplicationSupportDir(),
		StdOutPath:  paths.StdOutLogPath(),
		StdErrPath:  paths.StdErrLogPath(),
	})
	if err != nil {
		return InstallResult{}, err
	}
	if err := os.WriteFile(plistPath, plist, 0o644); err != nil {
		return InstallResult{}, fmt.Errorf("write launch agent: %w", err)
	}

	_ = cfg
	_ = token

	return InstallResult{
		ConfigPath:      paths.ConfigPath(),
		TokenPath:       paths.TokenPath(),
		LaunchAgentPath: plistPath,
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

	currentHash, err := configCertHash(currentPath)
	if err != nil {
		return err
	}
	cfg.Cert.CurrentPath = currentPath
	cfg.Cert.CurrentHash = currentHash

	if _, err := os.Stat(nextPath); err == nil {
		nextHash, hashErr := configCertHash(nextPath)
		if hashErr != nil {
			return hashErr
		}
		cfg.Cert.NextPath = nextPath
		cfg.Cert.NextHash = nextHash
	}

	return config.Save(paths.ConfigPath(), *cfg)
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
