# Stage 1: Build the application
# We use a node image to build the React application
FROM node:20-alpine as build
WORKDIR /app

# Install dependencies
# Copy package files first to leverage Docker cache for dependencies
COPY package*.json ./
# Use 'npm ci' for a clean, reproducible install based on lockfile
RUN npm ci

# Copy source and build
COPY . .
# Allow customizing the base path (useful if hosting on a subpath)
ARG BASE_PATH=/
RUN npm run build -- --base=${BASE_PATH}

# Stage 2: Serve with Nginx
# We use a lightweight Nginx image to serve the static files
FROM nginx:alpine
# Copy the built artifacts from the previous stage to Nginx's html directory
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
