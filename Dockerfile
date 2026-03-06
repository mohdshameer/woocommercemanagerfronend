# Use an official Node.js image based on Debian
FROM node:22-bullseye

# Install MongoDB
# Import the public key for the MongoDB package management system
RUN apt-get update && apt-get install -y gnupg wget \
    && wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | apt-key add - \
    && echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/debian bullseye/mongodb-org/6.0 main" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list \
    && apt-get update \
    && apt-get install -y mongodb-org \
    && rm -rf /var/lib/apt/lists/*

# Create MongoDB data directory
RUN mkdir -p /data/db

# Set up application directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Copy application source code
COPY . .

# Copy and make the startup script executable
COPY start.sh /usr/src/app/start.sh
RUN chmod +x /usr/src/app/start.sh

# Expose port for the app (MongoDB uses 27017 internally)
EXPOSE 3000

# Start both MongoDB and the Node.js application
CMD ["/usr/src/app/start.sh"]
