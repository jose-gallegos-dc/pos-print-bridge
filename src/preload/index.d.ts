export interface AgentConfig {
  serverPort: number;
  launchAtStartup: boolean;
  agentToken: string;
  testPrinterIp?: string;
  testPrinterPort?: number;
  usbDeviceKey?: string;
  usbPortPath?: string;
}

export interface UsbPrinterInfo {
  deviceKey: string;
  vendorId: string;
  productId: string;
  manufacturer: string;
  product: string;
}

export interface SerialPortInfo {
  path: string;
  manufacturer: string;
  vendorId: string;
  productId: string;
}

export interface TestPrintResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface AgentApi {
  getConfig(): Promise<AgentConfig>;
  saveConfig(config: Partial<AgentConfig>): Promise<{ success: boolean }>;
  regenerateToken(): Promise<string>;
  testPrint(connectionType: 'network' | 'usb' | 'serial'): Promise<TestPrintResult>;
  listUsbPrinters(): Promise<UsbPrinterInfo[]>;
  getSerialPorts(): Promise<SerialPortInfo[]>;
  getVersion(): Promise<string>;
}

declare global {
  interface Window {
    agent: AgentApi;
  }
}
