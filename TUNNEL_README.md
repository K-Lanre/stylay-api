# LocalTunnel Setup for Stylay API

This guide explains how to use localtunnel to expose your local Stylay API to the internet for testing purposes.

## 🚀 Quick Start

### 1. Start Your Local Server
Make sure your Stylay API is running locally:
```bash
npm run dev
```

### 2. Start the Tunnel
Use the custom subdomain `stylay-api`:
```bash
npm run tunnel:start
```

Or start both server and tunnel together:
```bash
npm run tunnel:dev
```

### 3. Access Your API
Once the tunnel is established, you'll see output like:
```
✅ Tunnel established successfully!
🌐 Local URL: http://localhost:3000
🔗 Public URL: https://stylay-api.loca.lt
🎯 Custom subdomain: https://stylay-api.localtunnel.me
```

## 📋 Available Commands

| Command | Description |
|---------|-------------|
| `npm run tunnel` | Show tunnel help and usage |
| `npm run tunnel:start` | Start tunnel with default subdomain |
| `npm run tunnel:start custom-name` | Start tunnel with custom subdomain |
| `npm run tunnel:stop` | Stop the active tunnel |
| `npm run tunnel:info` | Show current tunnel information |
| `npm run tunnel:dev` | Start both server and tunnel together |

## 🔧 Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Tunnel Configuration
TUNNEL_SUBDOMAIN=stylay-api
```

### Custom Subdomains

You can use any subdomain you want:

```bash
# Use default subdomain (stylay-api)
npm run tunnel:start

# Use custom subdomain
node tunnel.js start mystore
npm run tunnel:start mystore
```

## 🌐 CORS Configuration

The API is already configured to accept localtunnel URLs. The following patterns are allowed:

- `https://*.localtunnel.me`
- `https://*.ngrok.io`
- `https://*.ngrok-free.app`
- Common development origins (localhost:3000, localhost:5173, etc.)

## 🧪 Testing Your API

Once your tunnel is running, you can test your API from anywhere:

### Using cURL:
```bash
curl https://stylay-api.localtunnel.me/api/v1/products
```

### Using Postman:
1. Set the base URL to: `https://stylay-api.localtunnel.me`
2. Add headers:
   - `Content-Type: application/json`
   - `ngrok-skip-browser-warning: true` (if needed)

### Mobile Testing:
You can test your API from mobile devices by using the tunnel URL.

## 🔒 Security Notes

- **Development Only**: Only use tunneling in development environments
- **HTTPS**: All localtunnel URLs use HTTPS by default
- **No Authentication**: Anyone with the URL can access your API
- **Rate Limiting**: Your existing rate limiting still applies

## 🛠️ Troubleshooting

### Port Already in Use
If you get `EADDRINUSE` error:
```bash
# Find what's using the port
netstat -ano | findstr :3000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

### Tunnel Connection Issues
```bash
# Check if localtunnel is available
npx localtunnel --version

# Try a different subdomain if yours is taken
npm run tunnel:start your-unique-subdomain
```

### CORS Issues
If you encounter CORS errors:
1. Make sure your frontend sends the correct `Origin` header
2. Check that your request includes `credentials: true` for authenticated requests
3. Verify the request method is allowed (GET, POST, PUT, PATCH, DELETE, OPTIONS)

## 📝 Advanced Usage

### Programmatic Usage

```javascript
const TunnelManager = require('./tunnel');

const tunnelManager = new TunnelManager();

// Start tunnel
const tunnel = await tunnelManager.start();

// Get tunnel info
const info = tunnelManager.getTunnelInfo();
console.log('Tunnel URL:', info.url);

// Close tunnel
await tunnelManager.close();
```

### Custom Configuration

```javascript
const tunnelManager = new TunnelManager();
// Override default settings
tunnelManager.port = 3001;
tunnelManager.subdomain = 'my-custom-api';
```

## 🔄 Integration with Frontend

When testing with your frontend application, update the API base URL:

```javascript
// Instead of: http://localhost:3000
const API_BASE_URL = 'https://stylay-api.localtunnel.me';
```

## 📊 Monitoring

The tunnel provides real-time connection information:

- **Connection Status**: Active/inactive tunnel status
- **Request Count**: Number of requests through the tunnel
- **Bandwidth Usage**: Data transfer statistics
- **Connection Logs**: Real-time request logging

## 🛑 Cleanup

Always close your tunnel when not in use:

```bash
npm run tunnel:stop
```

The tunnel will also automatically close when you:
- Press `Ctrl+C` in the terminal
- Restart your development server
- Close your terminal session

---

**Happy Testing! 🎉**

Your Stylay API is now accessible from anywhere in the world via localtunnel!
