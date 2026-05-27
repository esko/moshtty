#!/usr/bin/env bash
# Cross-compile moshtty-remote and moshttyctl for GitHub release assets.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(tr -d '[:space:]' < "${ROOT}/version/companion")"
OUT_DIR="${ROOT}/dist/release/${VERSION}"
LDFLAGS="-s -w -X github.com/moshtty/moshtty/internal/version.Version=${VERSION}"

rm -rf "${OUT_DIR}"
mkdir -p "${OUT_DIR}"

build_one() {
  local component="$1"
  local goos="$2"
  local goarch="$3"
  local out="${OUT_DIR}/${component}-${goos}-${goarch}"
  echo "building ${out}"
  (
    cd "${ROOT}"
    CGO_ENABLED=0 GOOS="${goos}" GOARCH="${goarch}" \
      go build -ldflags "${LDFLAGS}" -o "${out}" "./cmd/${component}"
  )
  chmod +x "${out}"
}

for goos in darwin linux; do
  for goarch in amd64 arm64; do
    build_one moshtty-remote "${goos}" "${goarch}"
    build_one moshttyctl "${goos}" "${goarch}"
  done
done

echo "release assets in ${OUT_DIR}"
ls -la "${OUT_DIR}"
