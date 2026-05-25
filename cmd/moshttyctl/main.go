package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/moshtty/moshtty/internal/config"
	"github.com/moshtty/moshtty/internal/ctlsocket"
)

func main() {
	defaultSocket := filepath.Join(config.DefaultPaths().ApplicationSupportDir(), "moshtty.sock")
	socketFlag := flag.String("socket", defaultSocket, "Unix socket path")
	flag.Parse()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	client, err := ctlsocket.Dial(ctx, *socketFlag)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
	defer client.Close()

	res, err := client.Call(ctx, "health", nil)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	fmt.Println(string(res))
}
