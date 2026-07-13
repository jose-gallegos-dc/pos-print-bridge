# POS Print Bridge

Agente de escritorio ligero (Windows, Ubuntu y Fedora) que actua como puente entre un sistema de punto de venta (POS) y las impresoras de tickets.

Corre en segundo plano en la maquina del POS y levanta un servidor HTTP local (por defecto en el puerto `5100`, configurable). Cuando el sistema de venta necesita imprimir un ticket, envia una peticion HTTP al agente, y este traduce y envia los comandos ESC/POS a la impresora correspondiente:

- **Impresoras termicas USB**, mediante acceso directo al dispositivo (o al spooler nativo en Windows).
- **Impresoras de red**, via TCP crudo (puerto `9100` / RAW).
- **Impresoras seriales** (RS232 / adaptador USB-Serial).

Incluye una interfaz de configuracion para hacer pruebas de impresion, elegir la impresora USB, cambiar el puerto del servidor y activar el inicio automatico con el sistema. En resumen: es el intermediario que le permite a un POS (especialmente si es web) imprimir tickets en hardware fisico, sin que el navegador tenga que lidiar con USB ni sockets directamente.

## Stack tecnologico

- **[Electron](https://www.electronjs.org/)** — proceso principal en Node.js, empaquetado multiplataforma (Windows/Linux) y bandeja del sistema.
- **[React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)** — interfaz de configuracion (renderer process).
- **[MUI (Material UI)](https://mui.com/)** — componentes de interfaz siguiendo Material Design.
- **[Vite](https://vitejs.dev/) + [electron-vite](https://electron-vite.org/)** — bundling y entorno de desarrollo con HMR.
- **[Express](https://expressjs.com/)** — servidor HTTP local que expone la API de impresion.
- **[usb](https://www.npmjs.com/package/usb)** (libusb) — comunicacion con impresoras termicas USB en Linux/macOS.
- **[serialport](https://serialport.io/)** — comunicacion con impresoras/adaptadores seriales (RS232).
- **[electron-store](https://www.npmjs.com/package/electron-store)** — persistencia de configuracion local.
- **[electron-builder](https://www.electron.build/)** — generacion de instaladores (`.exe`/NSIS, `.deb`, `.rpm`, `.AppImage`).
- **pnpm** — gestor de paquetes.

## Arquitectura

```
Sistema POS (web / escritorio)
        │ HTTP POST http://127.0.0.1:5100/print/...
        ▼
POS Print Bridge
 ├─ Servidor HTTP (127.0.0.1, solo local)
 ├─ UI de configuracion (React + MUI)
 └─ Motor de impresion
     ├─ USB   → libusb / spooler de Windows
     ├─ Red   → TCP directo a IP:9100
     └─ Serial→ puerto RS232 / USB-Serial
```

## Desarrollo

```bash
pnpm install
pnpm dev
```

## Build de instaladores

```bash
pnpm build:win     # Windows (.exe / NSIS)
pnpm build:linux   # Ubuntu y Fedora (.deb, .rpm, .AppImage)
```
