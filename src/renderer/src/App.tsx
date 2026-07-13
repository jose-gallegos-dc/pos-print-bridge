import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Header from './components/Header';
import StatusBar from './components/StatusBar';
import NetworkPrintSection from './components/NetworkPrintSection';
import UsbPrintSection from './components/UsbPrintSection';
import SerialPrintSection from './components/SerialPrintSection';
import ConfigSection from './components/ConfigSection';
import type { AgentConfig } from '../../preload';

export default function App() {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [version, setVersion] = useState('0.0.0');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const [cfg, v] = await Promise.all([window.agent.getConfig(), window.agent.getVersion()]);
      setConfig(cfg);
      setVersion(v);
    })();
  }, []);

  if (!config) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ height: '100vh' }}>
        <CircularProgress size={28} />
      </Stack>
    );
  }

  function update(patch: Partial<AgentConfig>) {
    setConfig((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    setSaved(false);
    try {
      await window.agent.saveConfig({
        serverPort: config.serverPort,
        launchAtStartup: config.launchAtStartup,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerateToken() {
    const token = await window.agent.regenerateToken();
    update({ agentToken: token });
  }

  return (
    <Box sx={{ height: '100vh', overflow: 'auto', bgcolor: 'background.default' }}>
      <Header version={version} />
      <StatusBar port={config.serverPort} />

      <Stack spacing={2} sx={{ p: 2 }}>
        <NetworkPrintSection
          ip={config.testPrinterIp || ''}
          port={config.testPrinterPort || 9100}
          onChange={(ip, port) => update({ testPrinterIp: ip, testPrinterPort: port })}
        />

        <UsbPrintSection
          deviceKey={config.usbDeviceKey || ''}
          onChange={(deviceKey) => update({ usbDeviceKey: deviceKey })}
        />

        <SerialPrintSection
          portPath={config.usbPortPath || ''}
          onChange={(portPath) => update({ usbPortPath: portPath })}
        />

        <Divider />

        <ConfigSection
          port={config.serverPort}
          launchAtStartup={config.launchAtStartup}
          agentToken={config.agentToken}
          onPortChange={(port) => update({ serverPort: port })}
          onLaunchAtStartupChange={(value) => update({ launchAtStartup: value })}
          onRegenerateToken={handleRegenerateToken}
        />

        <Button variant="contained" color="secondary" size="large" disabled={saving} onClick={handleSave}>
          {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar configuracion'}
        </Button>
      </Stack>
    </Box>
  );
}
