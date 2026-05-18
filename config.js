import fs from "node:fs";
import { hashPassword } from "./encryption.js";
import dotenv from 'dotenv';
dotenv.config();

// Add users here - passwords will be hashed
const rawUsers = {
    // Example: 'admin': 'Skootyshooty14'
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

export { users, port, brokenSites };