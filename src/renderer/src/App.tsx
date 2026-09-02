import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import Header from './components/Header';
import StatusBar from './components/StatusBar';
import UpdateSection from './components/UpdateSection';
import PrintTestsSection from './components/PrintTestsSection';
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

  return (
    <Box sx={{ height: '100vh', overflow: 'auto', bgcolor: 'background.default' }}>
      <Header version={version} />
      <StatusBar port={config.serverPort} />
      <Box sx={{ mt: 1 }}>
        <UpdateSection />
      </Box>

      <Stack spacing={2} sx={{ p: 2 }}>
        <PrintTestsSection
          ip={config.testPrinterIp || ''}
          port={config.testPrinterPort || 9100}
          onNetworkChange={(ip, port) => update({ testPrinterIp: ip, testPrinterPort: port })}
          deviceKey={config.usbDeviceKey || ''}
          onUsbChange={(deviceKey) => update({ usbDeviceKey: deviceKey })}
          portPath={config.usbPortPath || ''}
          onSerialChange={(portPath) => update({ usbPortPath: portPath })}
        />

        <ConfigSection
          port={config.serverPort}
          launchAtStartup={config.launchAtStartup}
          onPortChange={(port) => update({ serverPort: port })}
          onLaunchAtStartupChange={(value) => update({ launchAtStartup: value })}
          saving={saving}
          saved={saved}
          onSave={handleSave}
        />
      </Stack>
    </Box>
  );
}
