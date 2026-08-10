#!/usr/bin/env bash

set -u

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
log_file="${TMPDIR:-/tmp}/coolstone-jekyll-server.log"

bundle_bin=""
jekyll_bin=""
for candidate in \
  "$(command -v bundle 2>/dev/null || true)" \
  /opt/homebrew/bin/bundle \
  /usr/local/bin/bundle \
  /opt/homebrew/opt/ruby/bin/bundle \
  /usr/local/opt/ruby/bin/bundle \
  "$HOME/.rbenv/shims/bundle" \
  "$HOME/.rvm/bin/bundle"
do
  if [ -n "$candidate" ] && [ -x "$candidate" ]; then
    bundle_bin="$candidate"
    break
  fi
done

for candidate in \
  "$(command -v jekyll 2>/dev/null || true)" \
  /opt/homebrew/bin/jekyll \
  /usr/local/bin/jekyll
do
  if [ -n "$candidate" ] && [ -x "$candidate" ]; then
    jekyll_bin="$candidate"
    break
  fi
done

if lsof -nP -iTCP:4000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Jekyll server already running at http://127.0.0.1:4000"
  exit 0
fi

mkdir -p "$(dirname "$log_file")"

if [ -z "$bundle_bin" ]; then
  if [ -n "$jekyll_bin" ]; then
    nohup "$jekyll_bin" serve --livereload --incremental --force_polling --host 127.0.0.1 --port 4000 >"$log_file" 2>&1 &
    echo "Jekyll server starting at http://127.0.0.1:4000"
    echo "Log: $log_file"
    exit 0
  fi

  printf '%s\n' "Could not find bundle or jekyll on this Mac. Checked common install locations and PATH." >"$log_file"
  printf '%s\n' "Open a normal terminal and run: which jekyll && jekyll --version" >>"$log_file"
  exit 0
fi
nohup "$bundle_bin" exec jekyll serve \
  --livereload \
  --force_polling \
  --host 127.0.0.1 \
  --port 4000 \
  >"$log_file" 2>&1 &

echo "Jekyll server starting at http://127.0.0.1:4000"
echo "Log: $log_file"
exit 0