#!/usr/bin/env bash
#
# Deploy the current commit to wcfp.hpc4ai.unito.it over SSH.
#
# Matches the layout already on the host, which earlier deploys established:
#
#   /srv/wcfp/releases/<sha>/   one directory per release, holding build/ output + node_modules
#   /srv/wcfp/shared/           the DuckDB files, with wcfp.duckdb a symlink to the live one
#   /srv/wcfp/current           -> the live release  (created by this script the first time)
#
# nginx proxies wcfp.hpc4ai.unito.it to 127.0.0.1:3101, which is wcfp-next.service.
# That unit currently hardcodes a release path in ExecStart; this script repoints it at
# /srv/wcfp/current once, so every later deploy is a symlink swap and a restart.
#
# The database ships too. A release that queries a column the deployed database lacks fails at
# request time, not at deploy time — the About page reads `species.cultivated`, which the live
# database does not yet have.
#
# Usage:  ./scripts/deploy-ssh.sh
# Rollback is automatic if the health check does not return 200.

set -euo pipefail

HOST=${HOST:-ubuntu@130.192.212.149}
APP=/srv/wcfp
SERVICE=${SERVICE:-wcfp-next}
HEALTH=${HEALTH:-https://wcfp.hpc4ai.unito.it/about}
PROBE=${PROBE:-https://wcfp.hpc4ai.unito.it/species/14370}

SHA=$(git rev-parse --short HEAD)
RELEASE="$APP/releases/$SHA"
DB_LOCAL=data/wcfp.duckdb
# Named by content, not by commit. The database is not in git, so two deploys of the same commit
# can carry different databases — keying on the SHA alone would overwrite the file the previous
# release is still reading, and take away the rollback target at the same time.
DB_SUM=$(shasum -a 256 "$DB_LOCAL" | awk '{print $1}')
DB_REMOTE="$APP/shared/wcfp-${DB_SUM:0:12}.duckdb"

say() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }
remote() { ssh -o BatchMode=yes "$HOST" "$@"; }

# /srv/wcfp belongs to the `wcfp` service account once setup-runner.sh has run, so this script —
# which connects as ubuntu — writes there through sudo rather than directly. Anything that only
# reads, or that needs root, is left alone.
OWNER=${OWNER:-wcfp}
as_owner() { remote "sudo -u $OWNER bash -c '$1'"; }
RSYNC_AS_OWNER=(--rsync-path="sudo -u $OWNER rsync")

say "Deploying $SHA to $HOST"
git diff --quiet || { echo "Working tree is dirty. Commit or stash first."; exit 1; }

say "Recording what is live now, for rollback"
PREV_EXEC=$(remote "systemctl cat $SERVICE | sed -n 's/^ExecStart=//p'")
PREV_DB=$(remote "readlink -e $APP/shared/wcfp.duckdb")
echo "   release: $PREV_EXEC"
echo "   database: $PREV_DB"

say "Building"
rm -rf build
pnpm build

say "Uploading the release"
as_owner "mkdir -p $RELEASE"
rsync -az --delete --exclude node_modules "${RSYNC_AS_OWNER[@]}" -e 'ssh -o BatchMode=yes' build/ "$HOST:$RELEASE/"
rsync -az "${RSYNC_AS_OWNER[@]}" -e 'ssh -o BatchMode=yes' package.json pnpm-lock.yaml "$HOST:$RELEASE/"

# "svelte-kit: not found" here is expected and harmless: the `prepare` script calls svelte-kit,
# which is a devDependency and so absent from a --prod install. package.json already ends that
# script in `|| echo ''` for exactly this case.
say "Installing production dependencies on the host"
as_owner "cd $RELEASE && pnpm install --prod --frozen-lockfile 2>&1 | tail -5"
as_owner "test -d $RELEASE/node_modules/duckdb" \
	|| { echo "   duckdb did not install into the release — aborting, nothing swapped."; exit 1; }

# --progress, not --info=progress2: recent macOS ships openrsync, which does not implement the
# GNU --info flag. --progress is understood by both.
say "Uploading the database ($(du -h $DB_LOCAL | cut -f1)) — this takes a few minutes"
rsync -az --progress "${RSYNC_AS_OWNER[@]}" -e 'ssh -o BatchMode=yes' "$DB_LOCAL" "$HOST:$DB_REMOTE"

REMOTE_SUM=$(remote "sha256sum $DB_REMOTE | awk '{print \$1}'")
[ "$DB_SUM" = "$REMOTE_SUM" ] || { echo "Database checksum mismatch — aborting before anything is swapped."; exit 1; }
echo "   checksum matches"

# A checksum proves the bytes arrived, not that they are the right bytes. This release queries
# columns an older database will not have; catching that here means the swap never happens, rather
# than the site serving 500s until someone opens the page.
#
# Run from inside the uploaded release, which already has the duckdb npm package from the install
# above — the host has no duckdb CLI.
say "Checking the uploaded database against what this release queries"
rsync -az "${RSYNC_AS_OWNER[@]}" -e 'ssh -o BatchMode=yes' scripts/check-db-schema.js "$HOST:$RELEASE/check-db-schema.js"
as_owner "cd $RELEASE && node check-db-schema.js $DB_REMOTE" \
	|| { echo "   Aborting — nothing swapped, the site is untouched."; exit 1; }

say "Activating"
# Both swaps are renames, so the service never observes a half-written target.
as_owner "ln -sfn $DB_REMOTE $APP/shared/wcfp.duckdb.new && mv -T $APP/shared/wcfp.duckdb.new $APP/shared/wcfp.duckdb"
as_owner "ln -sfn $RELEASE $APP/current.new && mv -T $APP/current.new $APP/current"

# Point the unit at the symlink rather than at a release path, once.
remote "sudo systemctl set-property $SERVICE.service Description='WCFP Explorer (adapter-node, /srv/wcfp/current)' 2>/dev/null || true"
remote "sudo mkdir -p /etc/systemd/system/$SERVICE.service.d && printf '[Service]\nWorkingDirectory=$APP/current\nExecStart=\nExecStart=/usr/bin/node $APP/current/index.js\n' | sudo tee /etc/systemd/system/$SERVICE.service.d/override.conf >/dev/null"
remote "sudo systemctl daemon-reload && sudo systemctl restart $SERVICE"

say "Health check"
sleep 4
CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$HEALTH" || echo 000)
PROBE_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$PROBE" || echo 000)
echo "   $HEALTH -> $CODE"
echo "   $PROBE -> $PROBE_CODE"

if [ "$CODE" != "200" ] || [ "$PROBE_CODE" != "200" ]; then
	say "FAILED — rolling back"
	as_owner "ln -sfn $PREV_DB $APP/shared/wcfp.duckdb.new && mv -T $APP/shared/wcfp.duckdb.new $APP/shared/wcfp.duckdb"
	remote "sudo rm -f /etc/systemd/system/$SERVICE.service.d/override.conf && sudo systemctl daemon-reload && sudo systemctl restart $SERVICE"
	sleep 4
	echo "   after rollback: $(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$HEALTH")"
	exit 1
fi

say "Live: $SHA"
as_owner "ls -1t $APP/releases | tail -n +6 | grep -v \"^$SHA\$\" | sed \"s|^|$APP/releases/|\" | xargs -r rm -rf || true"
echo "Older releases pruned to the most recent five."
