#!/usr/bin/env bash

# Update package lists
apt-get update -qq

# Install FFmpeg
apt-get install -y ffmpeg

# Create bin directory if it doesn't exist
mkdir -p bin

# Download and set up Rhubarb if it doesn't exist
if [ ! -f "bin/rhubarb" ]; then
  cd bin
  wget https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.13.0/rhubarb-lip-sync-1.13.0-linux.zip
  unzip rhubarb-lip-sync-1.13.0-linux.zip
  mv Rhubarb-Lip-Sync-1.13.0-Linux/rhubarb .
  rm -rf rhubarb-lip-sync-1.13.0-linux*
  chmod +x rhubarb
  cd ..
fi

# Create audios directory
mkdir -p audios

# Set permissions
chmod -R 755 bin
chmod -R 755 audios

# Install npm dependencies
npm install