<div align="center">
  <img src="public/icon_zero.png" height="120" alt="Zero Browser Logo">
  
  # Zero Browser
  
  **Privacy-first Chromium browser with built-in Tor integration**
  
  [![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/BrowserZer0/Zer0/releases)
  [![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
  [![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)](#platforms)

</div>

---

## About

Zero Browser is a privacy-focused secondary browser designed for secure, anonymous browsing. Built on Electron and Chromium, it features always-on incognito mode, integrated Tor network routing, and a clean, minimal interface - all without storing any browsing data.

Perfect for users who need a dedicated privacy browser alongside their daily driver.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🕵️ **Always Incognito** | Never stores browsing history, cookies, or cache |
| 🧅 **Built-in Tor** | Integrated Tor Expert Bundle for anonymous routing |
| 🚫 **Ad Blocker** | Native ad blocking without extensions |
| 🎨 **Minimal Design** | Clean, distraction-free interface |
| 🛡️ **Sandboxed** | Isolated browsing sessions for enhanced security |
| 🔒 **No Tracking** | Zero telemetry, analytics, or data collection |
| 🆓 **Always Free** | Open-source and free forever |
| 🖥️ **Cross-Platform** | Windows, Linux, and macOS support |

---

## 📥 Download

### Latest Release

Visit the [Releases page](https://github.com/BrowserZer0/Zer0/releases/latest) to download the latest version for your platform.

**System Requirements:**
- Windows 10/11, macOS 10.13+, or Linux (64-bit)
- 500 MB disk space
- 4 GB RAM (recommended)

---

## 🛠️ Build from Source

### Prerequisites
- Node.js 16+ and npm
- Git
- Tor Expert Bundle (for your platform)

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/BrowserZer0/Zer0.git
   cd Zer0
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Tor binary**
   
   Download Tor Expert Bundle from [torproject.org](https://www.torproject.org/download/tor/)
   
   - **Windows:** Place `tor.exe` at `./resources/win/Tor/tor.exe`
   - **Linux/Mac:** Place `tor` binary at `./resources/lin/tor`

4. **Build the browser**
   ```bash
   # Development mode
   npm run electron-dev
   
   # Production build (Windows)
   npm run build-win
   
   # Production build (macOS)
   npm run build-mac
   
   # Production build (Linux)
   npm run build-linux
   ```

### Build Scripts

```json
"scripts": {
  "start": "react-scripts start",
  "electron-dev": "concurrently \"npm start\" \"wait-on http://localhost:3000 && electron .\"",
  "build": "react-scripts build",
  "build-win": "electron-builder build --win --config electron-builder.json",
  "build-mac": "electron-builder build --mac --config electron-builder.json",
  "build-linux": "electron-builder build --linux --config electron-builder.json"
}
```

---

## 📁 Project Structure

```
zero_browser/
├── public/              # Static assets and Electron main process
│   ├── electron.js      # Main Electron process
│   ├── preload.js       # Preload scripts
│   └── functions/       # Tor integration, auto-updater, etc.
├── src/                 # React UI components
│   ├── components/      # UI screens (Home, Settings, etc.)
│   └── electron-tabs/   # Custom tab implementation
└── dist/                # Built browser packages (gitignored)
```

---

## 🐛 Issues & Support

**Found a bug?**  
[Create an issue](https://github.com/BrowserZer0/Zer0/issues/new) with detailed reproduction steps.

**Need help?**  
[Start a discussion](https://github.com/BrowserZer0/Zer0/discussions/new) or email us at [dev@zer0.build](mailto:dev@zer0.build)

**Security vulnerabilities?**  
Please report privately to [dev@zer0.build](mailto:dev@zer0.build)

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting PRs.

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📜 License

Zero Browser is licensed under the [MIT License](LICENSE).

---

## 👥 Team

**Zero Browser:**
- [BrowserZer0](https://github.com/BrowserZer0)

---

## 🌟 Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- Powered by [Tor Project](https://www.torproject.org/)

---

<div align="center">
  
  **[Website](https://zer0.build)** • **[Download](https://github.com/BrowserZer0/Zer0/releases)** • **[Documentation](https://github.com/BrowserZer0/Zer0/wiki)** • **[Twitter](#)**
  
  Made with ❤️ for privacy-conscious users
  
</div>