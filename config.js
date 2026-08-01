import fs from "node:fs";
import { hashPassword } from "./encryption.js";
import dotenv from 'dotenv';
dotenv.config();

// Add users here - passwords will be hashed
const rawUsers = {
    // Example: 'admin': '1234567890'
    //' 
};

// Hash passwords on startup
const users = {};
Object.keys(rawUsers).forEach(username => {
    users[username] = hashPassword(rawUsers[username]);
});

const port = 8080; //Change the port it binds to

//Edit broken-sites.json to prompt the user to redirect to a fixed version of a site (ex. now.gg --> nowgg.nl)
const brokenSites = async () => {
    const sites = JSON.parse(fs.readFileSync('./broken-sites.json', 'utf8'));
    sites.lastUpdate = Date.now();
    return sites;
};

// Allowed upstream hosts (SSRF allowlist) - must be set in environment variable ALLOWED_UPSTREAM_HOSTS as a comma-separated list.
const rawAllowed = (process.env.ALLOWED_UPSTREAM_HOSTS || '').trim();
if (!rawAllowed) {
    // Fail-closed default: refuse to run if allowlist isn't configured
    throw new Error('ALLOWED_UPSTREAM_HOSTS is not configured. For safety, the server will not start. Set ALLOWED_UPSTREAM_HOSTS=phantom.lol (or other hosts)');
}

const allowedUpstreamHosts = rawAllowed.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

export { users, port, brokenSites, allowedUpstreamHosts };
