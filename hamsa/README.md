# 🧘 Hamsa Healing — Web Deployment Guide

Welcome to the **Hamsa Healing** web setup guide. This document provides professional, step-by-step instructions to configure and run the application on your local machine or deploy it for web access.

Hamsa Healing is a high-performance wellness application built using **Expo**, **React Native Web**, and **React Native Skia**, delivering a fluid, immersive experience directly in the browser.

---

## � Table of Contents

1. [Prerequisites](#-prerequisites)
2. [Installation](#-installation)
3. [Running the Application](#-running-the-application)
4. [Building for Production](#-building-for-production)
5. [Key Technologies](#-key-technologies)
6. [Troubleshooting](#-troubleshooting)

---

## � Prerequisites

Before starting, ensure you have the following installed on your system:

- **Node.js (LTS):** Version 18 or higher is recommended. [Download here](https://nodejs.org/).
- **Package Manager:** `npm` (comes with Node.js) or `yarn`.
- **Modern Web Browser:** Chrome, Firefox, Safari, or Edge.

---

## 🚀 Installation

Follow these steps to set up the project environment:

### 1. Clone or Download the Project

Ensure you are in the project root directory (`HamsaHealing`).

### 2. Install Dependencies

Open your terminal and execute:

```bash
npm install
```

_This will install all necessary libraries, including React Native Skia, Reanimated, and Expo core components._

---

## 💻 Running the Application

To start the development server for the web:

### 1. Launch the Web Server

Run the following command in your terminal:

```bash
npx expo start --web
```

### 2. Access the App

- Once the command completes, your default browser should automatically open to `http://localhost:8081`.
- If it doesn't open, manually navigate to the URL provided in the terminal output.

---

## 🏗 Building for Production

To create a highly optimized static build for deployment:

1.  **Generate the Build:**
    ```bash
    npx expo export:web
    ```
2.  **Output:** The production-ready files will be generated in the `dist/` folder.
3.  **Deployment:** You can host the contents of the `dist/` folder on any static hosting service (Netlify, Vercel, GitHub Pages, etc.).

---

## ✨ Key Technologies

This application leverages cutting-edge web technologies to ensure a premium user experience:

- **Expo & React Native Web:** Enables a cross-platform codebase that runs seamlessly on browsers.
- **React Native Skia:** Powers high-performance 2D graphics and complex visual effects via WebGL/CanvasKit.
- **React Native Reanimated:** Handles fluid, 60fps animations and transitions.
- **TypeScript:** Ensures robust, type-safe development.

---

## 🔍 Troubleshooting

- **CanvasKit Errors:** If graphics fail to load, ensure your browser supports WebGL 2.0.
- **Port Conflicts:** If `8081` is in use, Expo will prompt you to use another port. Press `y` to accept.
- **Clean Reinstall:** If you encounter unexpected errors, try resetting the project:
  ```bash
  npm run reset-project
  ```
- **Stop the Server:** To stop the development server, press `Ctrl + C` in your terminal.

---

© 2026 Hamsa Healing. All rights reserved.
_Elevating wellness through technological excellence._
