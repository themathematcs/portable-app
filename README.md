# Portable Orb Reporting Setup

This project is a portable local-first monitoring and reporting app for Orb-connected sites. It reads live status data from the installed Orb app on the local machine, helps you configure schedules and delivery channels, and lets you pair WhatsApp directly inside the browser UI.

## What this app does

- Reads site and ISP details from the local Orb certificate and summary endpoint
- Fills the setup page with live Orb data automatically
- Saves local configuration for reporting, alerts, Telegram, and WhatsApp
- Runs a dry test without sending live reports
- Pairs WhatsApp in the browser UI with QR or pairing-code flow
- Keeps the setup compact enough to copy to another machine or friend-friendly bundle

## Main files

- ui-server.js — local web setup server and API routes
- ui/index.html — browser configuration UI
- src/orbLocal.js — Orb certificate-based local summary fetch
- src/whatsapp.js — WhatsApp pairing and connection handling
- agent.js — reporting and scheduling logic
- PORTABLE_SETUP.md — machine-by-machine setup guide for non-technical use

## Requirements

- Windows 10 or newer
- Node.js 18+ recommended
- Orb app already installed and running on the target machine
- Access to the local Orb certificate files on the machine

## Quick start

1. Open a terminal in this folder.
2. Install dependencies:

   npm install

3. Start the setup UI:

   npm run start-ui

4. Open the browser at:

   http://localhost:4173

5. Fill in the fields, save your settings, and test the app.

## Pairing WhatsApp

From the UI:

- choose QR or code pairing
- click Pair WhatsApp
- complete the pairing flow inside the same page

This keeps the pairing experience inside the app instead of sending you to a separate browser tab or process.

## Orb auto-detection

The app checks the local Orb installation and reads the site name, ISP, and system status automatically when available. That allows a smoother setup for machines that already have Orb installed and running.

## Optional Orb API key

For account-level Orb access, set the key as an environment variable on the target computer. Do not enter it in the UI, paste it into chat, commit it to Git, or place it in a public repository.

For the current PowerShell session:

```powershell
$env:ORB_API_TOKEN = 'paste-the-key-here'
npm run start-ui
```

For a persistent Windows user variable, use `setx ORB_API_TOKEN "paste-the-key-here"`, then open a new PowerShell window before starting the app. The key is not required for local certificate telemetry.

## Important notes

- The real Orb certificate and local auth files are not meant to be committed to a public repository.
- The app expects the local Orb environment on the machine running it.
- Keep the config file private if it contains real delivery credentials.

## Security and privacy

This project is designed for local use. Do not commit or share production keys, certificates, WhatsApp auth state, or environment secrets.

## License

This project is provided as-is for local operational use.
