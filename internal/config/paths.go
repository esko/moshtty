package config

import (
	"os"
	"path/filepath"
	"runtime"
)

const (
	AppName           = "Moshtty"
	DefaultUserBinDir = ".local/bin"
	LaunchAgentLabel  = "com.moshtty.remote"
)

// Paths resolves Moshtty user-local directories. Home overrides the user home
// directory for tests.
type Paths struct {
	Home string
}

func DefaultPaths() Paths {
	home, err := os.UserHomeDir()
	if err != nil {
		home = "."
	}
	return Paths{Home: home}
}

func (p Paths) ApplicationSupportDir() string {
	if runtime.GOOS == "darwin" {
		return filepath.Join(p.Home, "Library", "Application Support", AppName)
	}
	return filepath.Join(p.Home, ".local", "share", "moshtty")
}

func (p Paths) LaunchAgentsDir() string {
	return filepath.Join(p.Home, "Library", "LaunchAgents")
}

func (p Paths) LaunchAgentPath() string {
	return filepath.Join(p.LaunchAgentsDir(), LaunchAgentLabel+".plist")
}

func (p Paths) UserBinDir() string {
	return filepath.Join(p.Home, DefaultUserBinDir)
}

func (p Paths) ConfigPath() string {
	return filepath.Join(p.ApplicationSupportDir(), "config.json")
}

func (p Paths) StatePath() string {
	return filepath.Join(p.ApplicationSupportDir(), "state.json")
}

func (p Paths) TokenPath() string {
	return filepath.Join(p.ApplicationSupportDir(), "token")
}

func (p Paths) CertsDir() string {
	return filepath.Join(p.ApplicationSupportDir(), "certs")
}

func (p Paths) CurrentCertPath() string {
	return filepath.Join(p.CertsDir(), "current.pem")
}

func (p Paths) NextCertPath() string {
	return filepath.Join(p.CertsDir(), "next.pem")
}

func (p Paths) LogsDir() string {
	return filepath.Join(p.ApplicationSupportDir(), "logs")
}

func (p Paths) StdOutLogPath() string {
	return filepath.Join(p.LogsDir(), "moshtty-remote.out.log")
}

func (p Paths) StdErrLogPath() string {
	return filepath.Join(p.LogsDir(), "moshtty-remote.err.log")
}
