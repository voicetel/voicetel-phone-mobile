# 🎤 VoiceTel Phone

A mobile WebRTC SIP phone built with Capacitor for VoiceTel communications (Android and iOS). Make and receive calls directly on your device with a modern, touch‑first interface.

![Version](https://img.shields.io/badge/version-3.5.5-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Android%20%7C%20iOS-lightgrey)

## ✨ Features

### 📞 Core Telephony
- **WebRTC/SIP Integration** - Full SIP over WebSocket support using SIP.js
- **Outgoing Calls** - Dial any number with automatic number sanitization
- **Incoming Calls** - Visual call notifications with caller ID display
- **Call Controls** - Mute, hang up, call duration timer
- **DTMF Support** - Send touch-tone digits during calls via dialpad or keyboard
- **Ringing Handling** - Local ringback on 180/183; early media muted until answer

### 🔐 Security & Privacy
- **Local Storage** - Credentials stored locally using browser storage
- **Hide Caller ID** - Optional privacy mode for outgoing calls
- **No External Dependencies** - All data processing happens locally

### 🎨 User Interface
- **Tabbed Mobile UI**
  - 📞 Phone - Dialer and active call screen
  - 👥 Contacts - Device contacts integration (permission required)
  - 🕘 History - Recent calls list
  - 📋 Log - Real-time SIP message log
  - ⚙️ Settings - SIP configuration and credentials
- **Visual Call Indicators** - Ringing status and call duration display

### 🔧 Advanced Features
- **Caller ID Customization** - Set custom display name and 10-digit North American caller ID
- **Smart Number Handling** - Accepts any format, automatically cleans to digits
- **Auto-Rejection** - Busy signal for incoming calls when already on a call
- **30-Second Timeout** - Auto-decline unanswered incoming calls
- **Automatic DTMF** - RFC 2833 telephone-event with SIP INFO fallback
- **WebRTC Diagnostics** - Built-in troubleshooting tips for media negotiation issues

## 🚀 Installation

### Download Pre-built Binaries
Download the latest release for your platform from the [Releases](https://github.com/voicetel/voicetel-phone-mobile/releases).

### Build from Source

#### Prerequisites
- Node.js 16+ and npm
- Git

#### Steps
```bash
# Clone the repository
git clone https://github.com/voicetel/voicetel-phone-mobile.git
cd voicetel-phone-mobile

# Install dependencies
npm install

# Android: prepare Capacitor project
npx cap sync android

# Build a debug APK
(cd android && ./gradlew assembleDebug)

# Install debug APK to a device/emulator
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# Build a release AAB for Play Store
(cd android && ./gradlew bundleRelease)
# Output: android/app/build/outputs/bundle/release/app-release.aab

# Optional: iOS (on macOS)
npx cap sync ios
open ios/App/App.xcworkspace
# Build/run from Xcode
```

## 🙌 Contributors

We welcome contributions! Thanks to these awesome people:

- [Michael Mavroudis](https://github.com/mavroudis) - Lead Developer & Architect

## 💖 Sponsors

Proudly supported by:

| Sponsor | Contribution |
|---------|--------------|
| [VoiceTel Communications](https://www.voicetel.com) | Primary development and testing infrastructure |

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
