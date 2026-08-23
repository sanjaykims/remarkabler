#!/bin/sh
# Railway mounts the persistent volume after the image is built, so ownership
# set by the Dockerfile cannot make DATA_DIR writable. Reconcile the mounted
# tree while privileged, verify access, then replace this process with the app
# under its fixed unprivileged identity.
set -eu

app_user="remarkabler"
app_group="remarkabler"
data_dir="${DATA_DIR:-/data}"

# Keep newly written diary data private from any incidental users in the
# container. Existing permissions are preserved; ownership is repaired below.
umask 077

if [ "$(id -u)" -eq 0 ]; then
  mkdir -p "$data_dir"

  canonical_data_dir="$(cd "$data_dir" && pwd -P)"
  case "$canonical_data_dir" in
    /|/app|/app/*|/etc|/etc/*|/home|/home/*|/opt|/opt/*|/usr|/usr/*|/var|/var/*)
      echo "remarkabler-entrypoint: refusing unsafe DATA_DIR $canonical_data_dir" >&2
      exit 1
      ;;
  esac

  # -xdev prevents an unexpectedly nested mount from being traversed. Only
  # mismatched entries are passed to chown, avoiding metadata churn on normal
  # restarts while still migrating files created by older root-run images.
  find "$data_dir" -xdev \
    \( ! -user "$app_user" -o ! -group "$app_group" \) \
    -exec chown -h "$app_user:$app_group" {} +

  if ! gosu "$app_user:$app_group" test -w "$data_dir"; then
    echo "remarkabler-entrypoint: $data_dir is not writable by $app_user" >&2
    exit 1
  fi

  exec gosu "$app_user:$app_group" "$@"
fi

# Support platforms that enforce a non-root container user themselves, but do
# not start the app if their mounted volume is unusable under that identity.
if [ ! -w "$data_dir" ]; then
  echo "remarkabler-entrypoint: $data_dir is not writable by uid $(id -u)" >&2
  exit 1
fi

exec "$@"
