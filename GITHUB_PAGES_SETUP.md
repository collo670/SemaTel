# SemaTel PWA - GitHub Pages Setup Guide

## Overview
SemaTel is now configured as a Progressive Web App (PWA) that can be deployed and run on GitHub Pages. It works offline and can be installed as a native app on mobile devices.

## Setup Instructions

### 1. Enable GitHub Pages

1. Go to your repository: **collo670/SemaTel**
2. Click **Settings** (gear icon)
3. Scroll to **Pages** section
4. Under "Source", select:
   - Branch: `main`
   - Folder: `/ (root)`
5. Click **Save**

GitHub will deploy the site at: `https://collo670.github.io/SemaTel/`

### 2. What's Included

- **`manifest.json`** - PWA metadata and app configuration
- **`sw.js`** - Service Worker for offline functionality and caching
- **`.nojekyll`** - Tells GitHub Pages to skip Jekyll processing
- **`index.html`** - Main application with PWA support (served at root URL)

### 3. PWA Features Enabled

✅ **Installable**: Install as app on iOS and Android
✅ **Offline Support**: Works without internet connection
✅ **App Shortcuts**: Quick access to Airtime, Balance, Send Money
✅ **Native Feel**: Standalone display mode (full screen)
✅ **Safe Area Support**: Works with iPhone notches and home indicators
✅ **Fast Loading**: Service Worker caches assets for instant load

### 4. How to Install on Mobile

#### **Android**
1. Open `https://collo670.github.io/SemaTel/` in Chrome
2. Tap **3-dot menu** → **"Install app"**
3. Confirm installation

#### **iOS (Safari)**
1. Open `https://collo670.github.io/SemaTel/` in Safari
2. Tap **Share** → **"Add to Home Screen"**
3. Name it "SemaTel" and add
4. App will install with full offline support

### 5. Deployment Notes

- **No build process needed** - Just push to GitHub
- **Assets auto-cache** - Service Worker handles offline
- **Instant updates** - When you push changes, SW updates cache on next visit
- **HTTPS only** - GitHub Pages provides free HTTPS (required for PWA)

### 6. Testing Locally

#### **Test service worker offline:**
```bash
# Use Python's built-in server
python3 -m http.server 8000

# Or Node.js
npx http-server

# Visit: http://localhost:8000
```

#### **Test service worker in Chrome DevTools:**
1. Open DevTools → **Application** tab
2. Check **Service Workers** to see registration
3. Check **Cache Storage** to view cached files
4. Offline mode: DevTools → **Network** → Check "Offline"

### 7. Future Updates

When you update `index.html` or other files:
1. Push changes to `main` branch
2. GitHub Pages auto-deploys
3. Users will be prompted to update on next app launch
4. Service Worker automatically updates cache

### 8. Customize App Appearance

Edit `manifest.json` to change:
- **App name**: `"name"` and `"short_name"`
- **Colors**: `"theme_color"` and `"background_color"`
- **Icons**: Add custom SVG/PNG icons
- **Screenshots**: Add app store-style screenshots

### 9. Troubleshooting

**App not installing?**
- Ensure HTTPS (automatic on GitHub Pages)
- Check manifest.json is valid (use [manifest validator](https://manifest-validator.appspot.com/))
- Service Worker must be registered (check DevTools → Application)

**Offline not working?**
- Check Service Worker registration in DevTools
- Check Cache tab - should show cached files
- Verify sw.js file exists and is accessible

**Performance issues?**
- Check Network tab for slow resources
- Consider preloading large assets in sw.js
- Minify CSS/JS further if needed

## Live URL
🌐 **https://collo670.github.io/SemaTel/**

After enabling GitHub Pages, your PWA will be live and installable!
