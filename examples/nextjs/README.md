# ESPTool React NextJS Example

This is a comprehensive example of using the `esptool-react` library in a Next.js application. It demonstrates all the key features of the ESPLoader tool including:

- Connecting to ESP devices via WebSerial
- Flashing firmware to ESP devices
- Interacting with the console
- Configuring various settings
- Error handling

## Prerequisites

- A modern browser that supports WebSerial API (Chrome, Edge)
- An ESP32 or ESP8266 device connected via USB
- Node.js and npm/pnpm/yarn installed

## Getting Started

1. Clone the repository
2. Install dependencies:
```bash
npm install
# or
pnpm install
# or
yarn install
```

3. Run the development server:
```bash
npm run dev
# or
pnpm dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Features Demonstrated

- **Device Connection**: Connect to and disconnect from ESP devices
- **Firmware Flashing**: Upload and flash binary files to specific memory addresses
- **Console Interaction**: Start/stop the console to view device output
- **Configuration**: Set baudrates, debug settings and more
- **Device Control**: Reset the device, erase flash memory

## ESPLoaderProvider Configuration

The `ESPLoaderProvider` component is configured with the following options:

```tsx
<ESPLoaderProvider
    calculateMD5Hash={calculateMD5Hash} // Required for firmware validation
    initialBaudrate={115200}            // Default programming baudrate
    initialConsoleBaudrate={115200}     // Default console baudrate
    initialDebugLogging={false}         // Enable/disable debug logging
    initialRomBaudrate={460800}         // ROM baudrate (optional)
>
    {/* Your application */}
</ESPLoaderProvider>
```

## Usage Tips

- When uploading firmware files, you can append the hex address to the filename (e.g., `bootloader.bin@0x1000`), and the address will be automatically extracted
- For best performance when flashing larger files, use higher baudrates (e.g., 460800 or 921600)
- Enable debug logging if you encounter connection issues
- Different ESP devices require different baudrate settings - consult your device documentation

## License

This example is part of the esptool-react library and is licensed under the Apache 2.0 License.
