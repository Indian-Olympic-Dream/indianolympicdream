# Stage 1: Build the Angular application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
# Copy the rest of the application source code
COPY . .

# Build the application for production
RUN npm run build

# Stage 2: Set up the production Nginx server
FROM nginx:1.25-alpine

# Copy the compiled application from the builder stage
COPY --from=builder /app/dist/indianolympicdream /usr/share/nginx/html

# Copy the Nginx configuration template
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# Copy and grant execution rights to the entrypoint script
COPY nginx/entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Set the entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]

# Expose port 80
EXPOSE 80
