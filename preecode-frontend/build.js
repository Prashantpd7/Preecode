#!/usr/bin/env node
/**
 * Cross-platform build script for Preecode Frontend
 * Works on Windows, macOS, and Linux
 */

const fs = require('fs');
const path = require('path');

console.log('🔨 Building Preecode Frontend...\n');

// Files and directories to copy
const itemsToCopy = [
  'assets',
  'auth',
  'layout',
  'pages',
  'api.js',
  'app.js',
  'index.html',
  'login.html',
  'register.html',
  'about.html',
  'privacy.html',
  'terms.html',
  'legal.html',
  'forgot-password.html',
  'styles.css',
  'tailwind-config.js',
  'theme.js'
];

const distDir = path.join(__dirname, 'dist');

// Step 1: Remove dist directory if it exists
if (fs.existsSync(distDir)) {
  console.log('🗑️  Removing old dist directory...');
  fs.rmSync(distDir, { recursive: true, force: true });
}

// Step 2: Create dist directory
console.log('📁 Creating dist directory...');
fs.mkdirSync(distDir, { recursive: true });

// Step 3: Copy files and directories
console.log('📦 Copying files...\n');

function copyRecursive(src, dest) {
  const stats = fs.statSync(src);
  
  if (stats.isDirectory()) {
    // Create directory if it doesn't exist
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    // Copy all contents
    const items = fs.readdirSync(src);
    items.forEach(item => {
      copyRecursive(path.join(src, item), path.join(dest, item));
    });
  } else {
    // Copy file
    fs.copyFileSync(src, dest);
  }
}

let successCount = 0;
let errorCount = 0;

itemsToCopy.forEach(item => {
  const srcPath = path.join(__dirname, item);
  const destPath = path.join(distDir, item);
  
  try {
    if (fs.existsSync(srcPath)) {
      copyRecursive(srcPath, destPath);
      console.log(`   ✅ ${item}`);
      successCount++;
    } else {
      console.log(`   ⚠️  ${item} (not found, skipping)`);
    }
  } catch (err) {
    console.error(`   ❌ ${item} - Error: ${err.message}`);
    errorCount++;
  }
});

console.log(`\n✨ Build complete!`);
console.log(`   📊 ${successCount} items copied successfully`);
if (errorCount > 0) {
  console.log(`   ⚠️  ${errorCount} items failed`);
  process.exit(1);
}
console.log(`   📂 Output: ${distDir}\n`);
