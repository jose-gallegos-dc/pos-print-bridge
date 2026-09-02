import { useState, type SyntheticEvent } from 'react';
import Paper from '@mui/material/Paper';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import NetworkPrintSection from './NetworkPrintSection';
import UsbPrintSection from './UsbPrintSection';
import SerialPrintSection from './SerialPrintSection';

interface Props {
  ip: string;
  port: number;
  onNetworkChange: (ip: string, port: number) => void;
  deviceKey: string;
  onUsbChange: (deviceKey: string) => void;
  winPrinterName: string;
  onWinPrinterChange: (name: string) => void;
  portPath: string;
  onSerialChange: (portPath: string) => void;
}

export default function PrintTestsSection({
  ip,
  port,
  onNetworkChange,
  deviceKey,
  onUsbChange,
  winPrinterName,
  onWinPrinterChange,
  portPath,
  onSerialChange,
}: Props) {
  const [tab, setTab] = useState(0);

  function handleTabChange(_e: SyntheticEvent, value: number) {
    setTab(value);
  }

  return (
    <Paper variant="outlined">
      <Tabs value={tab} onChange={handleTabChange} variant="fullWidth">
        <Tab label="RED" />
        <Tab label="USB" />
        <Tab label="USB SERIAL" />
      </Tabs>
      <Box sx={{ p: 2 }}>
        {tab === 0 && <NetworkPrintSection ip={ip} port={port} onChange={onNetworkChange} />}
        {tab === 1 && (
          <UsbPrintSection
            deviceKey={deviceKey}
            onChange={onUsbChange}
            winPrinterName={winPrinterName}
            onWinPrinterChange={onWinPrinterChange}
          />
        )}
        {tab === 2 && <SerialPrintSection portPath={portPath} onChange={onSerialChange} />}
      </Box>
    </Paper>
  );
}
