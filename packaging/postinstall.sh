#!/bin/bash
# Runs after .deb/.rpm installation (electron-builder afterInstall hook).
# Installs the udev rule needed to access USB thermal printers without root.
set -e

RULES_DST="/etc/udev/rules.d/99-pos-print-bridge.rules"

cat > "$RULES_DST" <<'EOF'
SUBSYSTEM=="usb", ATTR{bInterfaceClass}=="07", MODE="0664", GROUP="plugdev", TAG+="uaccess"
EOF

chmod 644 "$RULES_DST"

if command -v udevadm >/dev/null 2>&1; then
  udevadm control --reload-rules || true
  udevadm trigger || true
fi

echo "POS Print Bridge: regla udev instalada en $RULES_DST"
