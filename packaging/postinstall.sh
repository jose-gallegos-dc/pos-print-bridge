#!/bin/bash
# Runs after .deb/.rpm installation (electron-builder afterInstall hook).
# Installs the udev rule needed to access USB thermal printers without root.
# Keep in sync with packaging/70-pia.rules.
set -e

RULES_DST="/etc/udev/rules.d/70-pia.rules"

# Rule installed by releases named "POS Print Bridge": it never matched
# (see 70-pia.rules), so drop it.
rm -f /etc/udev/rules.d/99-pos-print-bridge.rules

cat > "$RULES_DST" <<'RULES'
SUBSYSTEM=="usb", ENV{DEVTYPE}=="usb_device", ENV{ID_USB_INTERFACES}=="*:07????:*", MODE="0664", GROUP="plugdev", TAG+="uaccess"
SUBSYSTEM=="usbmisc", KERNEL=="lp[0-9]*", TAG+="uaccess"
SUBSYSTEM=="usb", ENV{DEVTYPE}=="usb_device", ATTR{idVendor}=="0416|0483|0fe6|1fc9|20d1|28e9|4b43|6868", ENV{ID_USB_INTERFACES}=="*:ff????:*", TAG+="uaccess"
SUBSYSTEM=="tty", KERNEL=="ttyACM[0-9]*", ATTRS{idVendor}=="0416|0483|0fe6|1fc9|20d1|28e9|4b43|6868", TAG+="uaccess"
RULES

chmod 644 "$RULES_DST"

if command -v udevadm >/dev/null 2>&1; then
  udevadm control --reload-rules || true
  udevadm trigger --subsystem-match=usb --subsystem-match=usbmisc --subsystem-match=tty || true
fi

echo "pia: regla udev instalada en $RULES_DST"
