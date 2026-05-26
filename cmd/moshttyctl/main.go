package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/moshtty/moshtty/internal/config"
	"github.com/moshtty/moshtty/internal/ctlsocket"
)

func main() {
	defaultSocket := filepath.Join(config.DefaultPaths().ApplicationSupportDir(), "moshtty.sock")

	fs := flag.NewFlagSet("moshttyctl", flag.ExitOnError)
	socketPath := fs.String("socket", defaultSocket, "path to moshtty-remote control socket")

	if len(os.Args) < 2 {
		fmt.Fprintf(os.Stderr, "Usage: moshttyctl [--socket PATH] <command> [args...]\n")
		fmt.Fprintf(os.Stderr, "\nCommands:\n")
		fmt.Fprintf(os.Stderr, "  list                     List remote panes\n")
		fmt.Fprintf(os.Stderr, "  pane close <flow-id>     Close a remote pane\n")
		fmt.Fprintf(os.Stderr, "  cleanup list             List orphan panes\n")
		fmt.Fprintf(os.Stderr, "  cleanup kill <flow-id>   Kill an orphan pane\n")
		fmt.Fprintf(os.Stderr, "\nTab/split/focus commands require the Moshtty Electron app.\n")
		os.Exit(2)
	}

	_ = fs.Parse(os.Args[1:])
	args := fs.Args()
	if len(args) == 0 {
		fmt.Fprintf(os.Stderr, "moshttyctl: missing command\n")
		os.Exit(2)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	client, err := ctlsocket.Dial(ctx, *socketPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "moshttyctl: %v\n", err)
		os.Exit(1)
	}
	defer func() { _ = client.Close() }()

	cmd := args[0]
	cmdArgs := args[1:]

	var cmdErr error
	switch cmd {
	case "list":
		cmdErr = cmdList(ctx, client, cmdArgs)
	case "pane":
		if len(cmdArgs) == 0 {
			fmt.Fprintf(os.Stderr, "moshttyctl pane: missing subcommand (close)\n")
			os.Exit(2)
		}
		sub := cmdArgs[0]
		switch sub {
		case "close":
			cmdErr = cmdPaneClose(ctx, client, cmdArgs[1:])
		case "split", "focus", "rename":
			cmdErr = errAppRequired(sub)
		default:
			fmt.Fprintf(os.Stderr, "moshttyctl pane: unknown subcommand %q\n", sub)
			os.Exit(2)
		}
	case "cleanup":
		if len(cmdArgs) == 0 {
			fmt.Fprintf(os.Stderr, "moshttyctl cleanup: missing subcommand (list, kill)\n")
			os.Exit(2)
		}
		sub := cmdArgs[0]
		switch sub {
		case "list":
			cmdErr = cmdList(ctx, client, cmdArgs[1:])
		case "kill":
			cmdErr = cmdPaneClose(ctx, client, cmdArgs[1:])
		default:
			fmt.Fprintf(os.Stderr, "moshttyctl cleanup: unknown subcommand %q\n", sub)
			os.Exit(2)
		}
	case "tab":
		cmdErr = errAppRequired("tab")
	default:
		fmt.Fprintf(os.Stderr, "moshttyctl: unknown command %q\n", cmd)
		os.Exit(2)
	}

	if cmdErr != nil {
		fmt.Fprintf(os.Stderr, "moshttyctl: %v\n", cmdErr)
		os.Exit(1)
	}
}

func cmdList(ctx context.Context, client *ctlsocket.Client, _ []string) error {
	result, err := client.Call(ctx, "pane.list", nil)
	if err != nil {
		return err
	}

	var resp struct {
		Panes []struct {
			FlowID uint32 `json:"flowId"`
			Cols   int    `json:"cols"`
			Rows   int    `json:"rows"`
		} `json:"panes"`
	}
	if err := json.Unmarshal(result, &resp); err != nil {
		return fmt.Errorf("invalid response: %w", err)
	}

	if len(resp.Panes) == 0 {
		fmt.Println("No active panes.")
		return nil
	}

	fmt.Printf("%-10s %-8s %-8s\n", "FLOW ID", "COLS", "ROWS")
	for _, p := range resp.Panes {
		fmt.Printf("%-10d %-8d %-8d\n", p.FlowID, p.Cols, p.Rows)
	}
	return nil
}

func cmdPaneClose(ctx context.Context, client *ctlsocket.Client, args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("pane close requires a flowId argument")
	}

	id, err := strconv.ParseUint(args[0], 10, 32)
	if err != nil {
		return fmt.Errorf("invalid flowId: %s", args[0])
	}

	params := struct {
		FlowID uint32 `json:"flowId"`
	}{FlowID: uint32(id)}

	_, err = client.Call(ctx, "pane.close", params)
	if err != nil {
		return err
	}

	fmt.Printf("Pane %d closed.\n", id)
	return nil
}

func errAppRequired(cmd string) error {
	return fmt.Errorf("%q requires the Moshtty Electron app to be running — open it first", cmd)
}
