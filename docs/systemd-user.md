# Optional User Service

ChromeOS/Crostini setups vary in how user services are started. If user services are available, create:

```ini
[Unit]
Description=Crostini Ghostty Terminal

[Service]
WorkingDirectory=%h/crostini-ghostty-terminal/agent
ExecStart=%h/go/bin/crostini-ghostty-terminal-agent -web-dir %h/crostini-ghostty-terminal/web/dist
Restart=on-failure
RestartSec=2

[Install]
WantedBy=default.target
```

Then run:

```bash
cd ~/crostini-ghostty-terminal/agent
go build -o ~/go/bin/crostini-ghostty-terminal-agent .
systemctl --user daemon-reload
systemctl --user enable --now crostini-ghostty-terminal.service
```

If `systemctl --user` is unavailable, run the agent manually.
