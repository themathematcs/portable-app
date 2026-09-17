# Portable Orb Report Setup

This folder is a clean, portable copy of the Orb reporting app.

It is meant to be easy to copy to another Windows computer and run without needing to understand the internal Orb certificate setup.

## What you need

1. Windows computer
2. Orb already installed
3. Node.js installed
4. This folder copied to the computer

## Step 1: Install Node.js

Download and install Node.js from:

https://nodejs.org/

Then open PowerShell and verify:

```powershell
node -v
npm -v
```

If both commands return versions, Node.js is installed correctly.

## Step 2: Open PowerShell in this folder

Example:

```powershell
cd "C:\Users\YourName\Desktop\portable-app"
```

## Step 3: Start the setup screen

Run:

```powershell
npm run start-ui
```

Then open this in your browser:

```text
http://localhost:4173
```

This gives you a simple form to fill in your site name, WhatsApp recipient, Telegram details, and timing settings without using the terminal.

## Step 4: Install app dependencies

Run:

```powershell
npm install
```

This installs the packages the app needs.

## Step 5: Check that Orb is installed and ready

The app reads data from the local Orb installation on the computer.

Open this in File Explorer or PowerShell:

```powershell
%USERPROFILE%\.config\orb
```

If that folder exists, the local Orb certificate is available.

If it does not exist, Orb may not be installed correctly or may not have been opened once on that machine.

## Step 6: Save the settings in the browser form

Use the UI to enter:

- site name
- ISP name
- recipient WhatsApp number or group ID
- Telegram bot token and chat ID
- report time and alert timing

Then press Save.

## Step 7: Run the safe test mode

From the same command window, run:

```powershell
node agent.js --daily --dry-run
```

This checks the Orb data and creates the report without sending anything externally.

If it works, you are ready for the real run.

## Step 8: Run the report

```powershell
node agent.js --daily
```

That creates the live Orb report for the machine.

## If the app fails to start

### Problem: Node is not found

Install Node.js again and reopen PowerShell.

### Problem: Orb folder is missing

Open the Orb app once and make sure it has been set up on this computer.

Then check again:

```powershell
%USERPROFILE%\.config\orb
```

### Problem: port conflict

This app avoids the common localhost 3000 problem, but a port may still be blocked in some cases.

Try:

```powershell
$env:ORB_CLONE_PORT = "4317"
node agent.js --daily --dry-run
```

If that works, run the real report again:

```powershell
node agent.js --daily
```

## Simple version

If you want the shortest version to copy and paste:

```powershell
npm install
node agent.js --daily --dry-run
node agent.js --daily
```

## Important note

This project uses the Orb app installed on the local machine. It does not rely on a public API token or a remote service in the normal flow.

That is why it is portable: each machine reads its own local Orb data and certificate.
