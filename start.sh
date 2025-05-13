#!/bin/bash

# Start your app with PM2
pm2 start ecosystem.config.cjs

# Save the current state
pm2 save

# Keep PM2 running so Render doesn't shut it down
pm2-runtime ecosystem.config.cjs
