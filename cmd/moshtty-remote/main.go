package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"syscall"

	"github.com/moshtty/moshtty/internal/config"
	"github.com/moshtty/moshtty/internal/profile"
	"github.com/moshtty/moshtty/internal/remote"
	"github.com/moshtty/moshtty/internal/version"
)

const usage = `moshtty-remote companion

Usage:
  moshtty-remote run [--config-dir DIR]
  moshtty-remote install [--binary PATH] [--force]
  moshtty-remote profile [--host HOST]
  moshtty-remote health [--endpoint HOST:PORT]
  moshtty-remote version

User-local paths:
  Config/state: ~/Library/Application Support/Moshtty (macOS)
                ~/.local/share/moshtty (Linux)
  Service:      ~/Library/LaunchAgents/com.moshtty.remote.plist (macOS)
                ~/.config/systemd/user/moshtty-remote.service (Linux)
  Binaries:     ~/.local/bin (recommended install location)
`

func main() {
	if len(os.Args) < 2 {
		fmt.Fprint(os.Stderr, usage)
		os.Exit(2)
	}

	switch os.Args[1] {
	case "run":
		runCommand(os.Args[2:])
	case "install":
		installCommand(os.Args[2:])
	case "profile":
		profileCommand(os.Args[2:])
	case "health":
		healthCommand(os.Args[2:])
	case "version", "-v", "--version":
		fmt.Println(version.Version)
	case "help", "-h", "--help":
		fmt.Print(usage)
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\n\n%s", os.Args[1], usage)
		os.Exit(2)
	}
}

func pathsFromFlags(configDir string) config.Paths {
	paths := config.DefaultPaths()
	if configDir != "" {
		paths = config.Paths{Home: configDir}
	}
	return paths
}

func runCommand(args []string) {
	fs := flag.NewFlagSet("run", flag.ExitOnError)
	configDir := fs.String("config-dir", "", "override home directory for Moshtty paths (testing)")
	socketPath := fs.String("socket", "", "Unix socket path for local control")
	_ = fs.Parse(args)

	paths := pathsFromFlags(*configDir)
	runtime, err := remote.PrepareRuntime(paths)
	if err != nil {
		exitErr(err)
	}

	if *socketPath == "" {
		runtime.SocketPath = filepath.Join(paths.ApplicationSupportDir(), "moshtty.sock")
	} else {
		runtime.SocketPath = *socketPath
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	fmt.Fprintf(os.Stderr, "moshtty-remote listening on %s (health)\n", runtime.Config.HealthEndpoint())
	fmt.Fprintf(os.Stderr, "moshtty-remote webtransport on %s\n", runtime.Config.BindEndpoint())
	if runtime.SocketPath != "" {
		fmt.Fprintf(os.Stderr, "moshtty-remote control socket on %s\n", runtime.SocketPath)
	}

	if err := runtime.Run(ctx); err != nil && err != context.Canceled {
		exitErr(err)
	}
}

func installCommand(args []string) {
	fs := flag.NewFlagSet("install", flag.ExitOnError)
	binaryPath := fs.String("binary", "", "path to moshtty-remote binary")
	force := fs.Bool("force", false, "replace existing LaunchAgent plist")
	_ = fs.Parse(args)

	resolved, err := remote.ResolveBinaryPath(*binaryPath)
	if err != nil {
		exitErr(err)
	}

	result, err := remote.Install(remote.InstallOptions{
		Paths:      config.DefaultPaths(),
		BinaryPath: resolved,
		ForcePlist: *force,
	})
	if err != nil {
		exitErr(err)
	}

	fmt.Printf("Installed Moshtty remote companion\n")
	fmt.Printf("  config: %s\n", result.ConfigPath)
	fmt.Printf("  token:  %s\n", result.TokenPath)
	fmt.Printf("  agent:  %s\n", result.LaunchAgentPath)
	fmt.Printf("  bin:    %s (recommended copy target)\n", result.UserBinDir)
	if runtime.GOOS == "darwin" {
		fmt.Printf("\nLoad the agent with:\n  launchctl load -w %q\n", result.LaunchAgentPath)
	} else {
		fmt.Printf("\nLoad the agent with:\n  systemctl --user enable --now moshtty-remote\n")
	}
}

func profileCommand(args []string) {
	fs := flag.NewFlagSet("profile", flag.ExitOnError)
	host := fs.String("host", "", "host label for profile URL (defaults to system hostname)")
	configDir := fs.String("config-dir", "", "override home directory for Moshtty paths (testing)")
	_ = fs.Parse(args)

	paths := pathsFromFlags(*configDir)
	runtime, err := remote.PrepareRuntime(paths)
	if err != nil {
		exitErr(err)
	}

	if *host == "" {
		hostname, hostnameErr := os.Hostname()
		if hostnameErr != nil {
			exitErr(hostnameErr)
		}
		*host = hostname
	}

	output, err := profile.Format(profile.BuildInput{
		Config: runtime.Config,
		Token:  runtime.Token,
		Host:   *host,
	})
	if err != nil {
		exitErr(err)
	}
	fmt.Print(output)
}

func healthCommand(args []string) {
	fs := flag.NewFlagSet("health", flag.ExitOnError)
	endpoint := fs.String("endpoint", "", "health endpoint host:port")
	configDir := fs.String("config-dir", "", "override home directory for Moshtty paths (testing)")
	_ = fs.Parse(args)

	if *endpoint == "" {
		paths := pathsFromFlags(*configDir)
		cfg, err := config.Load(paths.ConfigPath())
		if err != nil {
			exitErr(err)
		}
		*endpoint = cfg.HealthEndpoint()
	}

	status, err := remote.CheckHealth(context.Background(), *endpoint)
	if err != nil {
		exitErr(err)
	}

	fmt.Printf("status=%s remoteId=%s serviceVersion=%s bind=%s\n",
		status.Status,
		status.RemoteID,
		status.ServiceVersion,
		status.BindEndpoint,
	)
}

func exitErr(err error) {
	fmt.Fprintf(os.Stderr, "moshtty-remote: %v\n", err)
	os.Exit(1)
}
