#!/bin/bash
set -e

# Start MongoDB in the background
echo "Starting MongoDB..."
mongod --fork --logpath /var/log/mongodb.log --dbpath /data/db

# Wait a moment for MongoDB to initialize
sleep 3

# Start the Node.js application
echo "Starting Node.js server..."
npm start
