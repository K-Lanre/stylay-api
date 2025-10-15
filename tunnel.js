#!/usr/bin/env node

const localtunnel = require('localtunnel');
const logger = require('./utils/logger');

class TunnelManager {
  constructor() {
    this.tunnel = null;
    this.port = process.env.PORT || 3000;
    this.subdomain = process.env.TUNNEL_SUBDOMAIN || 'stylay-api';
  }

  async start() {
    try {
      logger.info(`Starting tunnel with subdomain: ${this.subdomain}`);

      this.tunnel = await localtunnel({
        port: this.port,
        subdomain: this.subdomain,
        host: 'https://localtunnel.me'
      });

      logger.info(`Tunnel established successfully!`);
      logger.info(`Local URL: http://localhost:${this.port}`);
      logger.info(`Public URL: ${this.tunnel.url}`);
      logger.info(`Custom subdomain: https://${this.subdomain}.localtunnel.me`);

      // Handle tunnel events
      this.tunnel.on('close', () => {
        logger.info('Tunnel closed');
      });

      this.tunnel.on('error', (err) => {
        logger.error('Tunnel error:', err);
      });

      // Graceful shutdown
      process.on('SIGINT', () => {
        logger.info('Received SIGINT, closing tunnel...');
        this.close();
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        logger.info('Received SIGTERM, closing tunnel...');
        this.close();
        process.exit(0);
      });

      return this.tunnel;

    } catch (err) {
      logger.error('Failed to start tunnel:', err);
      throw err;
    }
  }

  async close() {
    if (this.tunnel) {
      this.tunnel.close();
      this.tunnel = null;
    }
  }

  getTunnelInfo() {
    if (!this.tunnel) {
      return null;
    }

    return {
      url: this.tunnel.url,
      subdomain: this.subdomain,
      port: this.port,
      customUrl: `https://${this.subdomain}.localtunnel.me`
    };
  }
}

// CLI interface
if (require.main === module) {
  const tunnelManager = new TunnelManager();

  // Handle different commands
  const command = process.argv[2];

  switch (command) {
    case 'start':
      tunnelManager.start().catch(err => {
        logger.error('Failed to start tunnel:', err);
        process.exit(1);
      });
      break;

    case 'stop':
      tunnelManager.close().then(() => {
        logger.info('Tunnel stopped');
        process.exit(0);
      });
      break;

    case 'info':
      const info = tunnelManager.getTunnelInfo();
      if (info) {
        console.log(JSON.stringify(info, null, 2));
      } else {
        console.log('No active tunnel');
      }
      break;

    default:
      console.log(`
LocalTunnel Manager for Stylay API

Usage:
  node tunnel.js start [subdomain]  - Start tunnel with custom subdomain
  node tunnel.js stop               - Stop the tunnel
  node tunnel.js info               - Show tunnel information

Examples:
  node tunnel.js start              - Start with default subdomain (stylay-api)
  node tunnel.js start mystore      - Start with custom subdomain (mystore)
  node tunnel.js stop               - Stop the tunnel
  node tunnel.js info               - Show tunnel details

Environment Variables:
  PORT                    - Local port (default: 3000)
  TUNNEL_SUBDOMAIN       - Default subdomain (default: stylay-api)
      `);
      break;
  }
}

module.exports = TunnelManager;
