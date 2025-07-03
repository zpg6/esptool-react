# esptool-react

A React library that provides hooks and context for programming ESP32/ESP8266 devices using esptool-js.

[![NPM Version](https://img.shields.io/npm/v/esptool-react)](https://www.npmjs.com/package/esptool-react)
[![NPM Downloads](https://img.shields.io/npm/dt/esptool-react)](https://www.npmjs.com/package/esptool-react)
[![License: MIT](https://img.shields.io/npm/l/esptool-react)](https://opensource.org/licenses/MIT)

**LIVE DEMO**: [https://esptool-react.com/](https://esptool-react.com/)

Demo implementation is available in the [`examples/nextjs/`](./examples/nextjs/) directory showcasing a complete ESP development console with programming and monitoring capabilities.

## Features

- 🔌 **React Hooks & Context**: Clean API for ESP device communication
- 📱 **Web Serial API Integration**: Direct browser-to-device communication
- 🌐 **Browser Compatibility Detection**: Automatic WebSerial support detection with user guidance
- 🔧 **Firmware Validation**: Built-in validation and guidance utilities
- 📊 **Real-time Progress**: Track flashing progress and device status
- 🎯 **TypeScript Support**: Full type safety and IntelliSense
- 🛠️ **Multi-chip Support**: Works with ESP32, ESP8266, and other ESP variants
- 📁 **File Management**: Handle multiple firmware files with address validation
- 🚀 **Modern React**: Built for React 17+ with hooks-first approach

## Installation

```bash
npm install esptool-react
```

## Usage

```tsx
import { ESPLoaderProvider, useEspLoader } from 'esptool-react';

function App() {
  return (
    <ESPLoaderProvider
      initialBaudrate={115200}
      initialDebugLogging={false}
    >
      <ESPProgrammer />
    </ESPLoaderProvider>
  );
}

function ESPProgrammer() {
  const { state, actions } = useEspLoader();
  
  const handleConnect = async () => {
    await actions.connect();
  };
  
  const handleFlash = async () => {
    const files = [/* your ESP files */];
    await actions.program(files);
  };
  
  return (
    <div>
      <p>Status: {state.isConnected ? 'Connected' : 'Disconnected'}</p>
      <button onClick={handleConnect}>Connect</button>
      <button onClick={handleFlash}>Flash Firmware</button>
    </div>
  );
}
```

## License

[MIT](./LICENSE)

## Contributing

Contributions are welcome! Whether it's bug fixes, feature additions, or documentation improvements, we appreciate your help in making this project better. For major changes or new features, please open an issue first to discuss what you would like to change. 