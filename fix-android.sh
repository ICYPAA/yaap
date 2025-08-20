#!/bin/bash

echo "=== Android Fix Script ==="
echo "This script will help rebuild your Android app with the fixes applied"
echo ""

# Check if we're in the right directory
if [ ! -f "app.json" ]; then
    echo "Error: app.json not found. Please run this script from the project root."
    exit 1
fi

echo "Step 1: Cleaning caches..."
npx expo prebuild --clean --platform android

echo ""
echo "Step 2: Clearing Metro bundler cache..."
npx expo start -c --clear

echo ""
echo "=== Build Instructions ==="
echo "The Android crash issue has been fixed by:"
echo "1. Correcting the google-services.json package name mismatch"
echo "2. Adding proper error handling for notifications"
echo "3. Removing immediate permission requests that could crash on startup"
echo ""
echo "To test on Android:"
echo "1. Run: npx expo run:android"
echo "   OR"
echo "2. Build for device: eas build --platform android --profile preview"
echo ""
echo "The app should now start without crashing on Android devices."