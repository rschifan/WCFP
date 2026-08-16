#!/usr/bin/env bash
#
# One-time: install a self-hosted GitHub Actions runner on the deployment host, so pushes to main
# deploy themselves. Mirrors the arrangement the sibling project (healthysustainablecities/ghsci)
# already uses on this machine.
#
# Run it from your laptop. It needs SSH access as ubuntu and gh authenticated to rschifan/WCFP.
#
#   ./scripts/setup-runner.sh
#
# The runner deliberately does NOT run as `ubuntu`. That account has blanket NOPASSWD sudo on this
# host, so a runner under it would give anything that can trigger a workflow full root. It runs as
# a dedicated `wcfp` user whose only privilege is restarting its own service — the same shape as
# the ghsci runner, whose sudoers entry is scoped to `systemctl start|stop ghsci-*`.

set -euo pipefail

HOST=${HOST:-ubuntu@130.192.212.149}
REPO=${REPO:-rschifan/WCFP}
RUNNER_USER=wcfp
RUNNER_DIR=/home/$RUNNER_USER/actions-runner
RUNNER_VERSION=${RUNNER_VERSION:-2.336.0}
SERVICE=wcfp-next

say() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }
remote() { ssh -o BatchMode=yes "$HOST" "$@"; }

say "Requesting a registration token for $REPO"
# Short-lived (one hour) and repo-scoped. Fetched at run time so it never lands in a file.
TOKEN=$(gh api -X POST "repos/$REPO/actions/runners/registration-token" --jq .token)
[ -n "$TOKEN" ] || { echo "Could not obtain a registration token."; exit 1; }

say "Creating the $RUNNER_USER service account"
remote "sudo id -u $RUNNER_USER >/dev/null 2>&1 || sudo useradd --system --create-home --shell /bin/bash $RUNNER_USER"

say "Granting it the release tree and nothing else"
remote "sudo chown -R $RUNNER_USER:$RUNNER_USER /srv/wcfp/releases /srv/wcfp/shared"
remote "sudo install -d -o $RUNNER_USER -g $RUNNER_USER /srv/wcfp"
# Scoped sudo: restart this one service, nothing more.
remote "printf '%s ALL=(root) NOPASSWD: /usr/bin/systemctl restart $SERVICE, /usr/bin/systemctl status $SERVICE\n' $RUNNER_USER | sudo tee /etc/sudoers.d/$RUNNER_USER >/dev/null && sudo chmod 0440 /etc/sudoers.d/$RUNNER_USER && sudo visudo -c -f /etc/sudoers.d/$RUNNER_USER"

say "Installing the runner ($RUNNER_VERSION)"
remote "sudo -u $RUNNER_USER mkdir -p $RUNNER_DIR"
remote "cd $RUNNER_DIR && sudo -u $RUNNER_USER curl -fsSL -o runner.tar.gz https://github.com/actions/runner/releases/download/v$RUNNER_VERSION/actions-runner-linux-x64-$RUNNER_VERSION.tar.gz && sudo -u $RUNNER_USER tar xzf runner.tar.gz && sudo -u $RUNNER_USER rm runner.tar.gz"
remote "sudo $RUNNER_DIR/bin/installdependencies.sh >/dev/null"

say "Registering with $REPO"
remote "cd $RUNNER_DIR && sudo -u $RUNNER_USER ./config.sh --unattended --replace --url https://github.com/$REPO --token '$TOKEN' --name wcfp.hpc4ai --labels self-hosted,wcfp --work _work"

say "Installing it as a service"
remote "cd $RUNNER_DIR && sudo ./svc.sh install $RUNNER_USER && sudo ./svc.sh start"

say "The workflow needs duckdb and pnpm on PATH for that user"
remote "sudo -u $RUNNER_USER bash -lc 'command -v duckdb >/dev/null || echo MISSING_DUCKDB; command -v node >/dev/null || echo MISSING_NODE'"

say "Registered runners"
gh api "repos/$REPO/actions/runners" --jq '.runners[] | "\(.name) | \(.status) | \(.labels | map(.name) | join(","))"'

cat <<'EOF'

Next:
  1. gh workflow enable Deploy
  2. Push to main, or: gh workflow run Deploy

The workflow refuses to activate a release whose queries need a database column the live
database lacks. Ship the database first with ./scripts/deploy-ssh.sh — after that, code
deploys itself on every push to main.
EOF
