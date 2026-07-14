# Plan de produccion

Como generar los instaladores de POS Print Bridge para Windows y Linux (Ubuntu/Fedora), y por que el agente exige un token en su API.

## Punto de partida: los modulos nativos no se cross-compilan

`usb` y `serialport` son modulos nativos (binarios `.node` compilados en C/C++). Cada uno se compila contra:

- la ABI exacta de la version de Electron usada (por eso `postinstall` corre `electron-rebuild`), y
- el sistema operativo y arquitectura de destino.

Un binario `.node` compilado en Linux **no funciona en Windows** y viceversa — no es algo que se pueda cross-compilar de forma confiable. Esto significa que **el build de Windows debe hacerse en Windows** (maquina, VM o runner de CI), y el de Linux en Linux. Es el riesgo #1 que ya anticipaba `.claude/PLAN-APP.md`.

Por eso este proyecto incluye un workflow de GitHub Actions (`.github/workflows/build.yml`) con una matriz `ubuntu-latest` + `windows-latest`: es la forma recomendada de generar ambos instaladores sin necesitar una maquina Windows fisica propia.

## Build local para Linux (Ubuntu / Fedora)

### Prerrequisitos — Ubuntu/Debian

```bash
sudo apt update
sudo apt install -y build-essential python3 libusb-1.0-0-dev libudev-dev
```

### Prerrequisitos — Fedora

```bash
sudo dnf install -y gcc gcc-c++ make python3 libusb1-devel systemd-devel
```

### Pasos

```bash
pnpm install       # compila usb/serialport contra Electron via el postinstall (electron-rebuild)
pnpm build:linux   # genera .deb, .rpm y .AppImage en release/
```

### Que hace cada paquete al instalarse

- **.deb / .rpm**: ejecutan `packaging/postinstall.sh`, que crea `/etc/udev/rules.d/99-pos-print-bridge.rules` y recarga udev. Esa regla es la que permite que un usuario normal (grupo `plugdev`) abra la impresora USB sin `sudo` — sin ella, el sintoma tipico es "no se detectaron impresoras USB" aun con la impresora bien conectada.
- **.AppImage**: no corre scripts de instalacion (no hay instalacion real), asi que la regla udev viaja embebida en `resources/99-pos-print-bridge.rules` dentro del propio paquete para instalarla a mano si hace falta. Ademas, `build/afterPack.js` envuelve el binario para forzar `ELECTRON_DISABLE_SANDBOX=1`, porque un AppImage corre sin privilegios y no puede fijar el bit SUID que Electron necesita para su sandbox normal.

## Build local para Windows

### Prerrequisitos

- Node.js 20 LTS
- pnpm
- Visual Studio Build Tools, con la carga de trabajo **"Desarrollo para el escritorio con C++"**
- Python 3

### Pasos

```powershell
pnpm install
pnpm build:win
```

Genera un instalador NSIS (`.exe`) en `release/`. A diferencia de Linux, en Windows la impresion USB no pasa por `libusb` sino por el spooler nativo (`winspool.drv`, ver `src/main/printer.js`), asi que no hace falta tocar drivers con Zadig ni reglas udev — el instalador no necesita pasos adicionales de permisos.

## CI: `.github/workflows/build.yml`

Matriz `ubuntu-latest` + `windows-latest`. En cada push a `main` y en cada tag `v*` compila ambos instaladores y los sube como artifacts (los tags ademas crean un GitHub Release con los instaladores adjuntos). Asi el unico requisito para publicar una version nueva es crear el tag; no hace falta una maquina Windows propia.

## Por que el agente exige un token (`X-Agent-Token`)

El servidor HTTP solo escucha en `127.0.0.1` — nunca queda expuesto a la red — pero **cualquier proceso o pestana de navegador que corra en esa misma maquina** puede alcanzar `http://127.0.0.1:5100` sin restriccion alguna; no hay aislamiento entre procesos locales solo por escuchar en localhost.

Sin el token, cualquiera de estos casos podria disparar impresiones sin que el POS lo pidiera:

- una pestana de navegador con un anuncio o script comprometido corriendo en la maquina del cajero,
- cualquier otro programa instalado en ese equipo,
- un usuario probando la API a mano por curiosidad.

El token es un secreto compartido entre el POS autorizado y el agente: sin conocerlo, ninguna otra aplicacion local puede usar `/print/*` aunque tecnicamente pueda alcanzar el puerto. Por eso `/health` es la unica ruta publica (sin token) — existe para que el POS pueda verificar que el agente esta corriendo antes de autenticarse e imprimir.

El POS debe enviar el token en cada peticion:

```
X-Agent-Token: <valor visible en la seccion Configuracion de la app>
```

El token se genera automaticamente la primera vez que corre el agente, y se puede regenerar desde la UI (esto invalida el anterior — hay que actualizar la configuracion del POS si se regenera).
