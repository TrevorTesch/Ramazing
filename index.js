import express from "express";
import basicAuth from "express-basic-auth"
import rateLimit from "express-rate-limit";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";
import http from "http";
import cookieParser from 'cookie-parser';
import * as cheerio from "cheerio";
import { doubleCsrf } from "csrf-csrf";
import { createServer } from "http";
import { fileURLToPath } from "url";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { join } from "path";
import { users, port, brokenSites, allowedUpstreamHosts } from "./config.js";
import session from "express-session";
import { encryptData, decryptData, generateToken as generateSecureToken, verifyPassword, hashPassword } from "./encryption.js";
import { validateUpstream } from './lib/ssrf-protect.js';
import { safeLog } from './lib/safe-log.js';
import https from 'https';

import dotenv from 'dotenv';
dotenv.config();

const version = process.env.npm_package_version;
const publicPath = fileURLToPath(new URL("./public/", import.meta.url));
const app = express();
const server = createServer();
const privacyRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
});

// Enable basic auth if users are configured
if (Object.keys(users).length > 0) {
    app.use(basicAuth({ 
        users, 
        challenge: true,
        unauthorizedResponse: 'Unauthorized: Please provide valid credentials'
    }));
    console.log('✓ Authentication enabled');
}
app.use(express.static(publicPath, { maxAge: 604800000 })); //1 week
app.use('/books/files/', async (req, res) => {
    const baseUrl = new URL("http://phantom.lol/books/files/");
    const routePath = req.path.replace(/^\/books\/files\/?/, "");

    let relativePath;
    try {
        relativePath = decodeURIComponent(routePath);
    } catch {
        res.status(400).json({ error: 'invalid_path' });
        return;
    }

    if (
        !relativePath ||
        relativePath.includes("..") ||
        relativePath.includes("\\") ||
        relativePath.includes("\0") ||
        relativePath.startsWith("/") ||
        relativePath.startsWith("//") ||
        /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(relativePath)
    ) {
        res.status(400).json({ error: 'invalid_path' });
        return;
    }

    const sourceUrl = new URL(relativePath, baseUrl);
    if (
        sourceUrl.origin !== baseUrl.origin ||
        !sourceUrl.pathname.startsWith("/books/files/")
    ) {
        res.status(400).json({ error: 'invalid_path' });
        return;
    }

    const queryString = new URLSearchParams(req.query).toString();
    if (queryString) {
        sourceUrl.search = queryString;
    }

    // Validate upstream against allowlist and private IPs
    try {
        await validateUpstream(sourceUrl.href, allowedUpstreamHosts);
    } catch (err) {
        safeLog('warn', { route: '/books/files', upstream: sourceUrl.hostname, errorCode: err.code || 'SSRF_FAIL' });
        return res.status(403).json({ error: 'ssrf_blocked', code: err.code || 'SSRF_BLOCKED' });
    }

    // Build sanitized headers (only a small allowlist)
    const allowedReqHeaders = ['user-agent', 'accept', 'accept-language', 'range'];
    const outHeaders = {};
    for (const h of allowedReqHeaders) {
        if (req.headers[h]) outHeaders[h] = req.headers[h];
    }
    // set host to upstream host explicitly
    outHeaders['host'] = sourceUrl.host;

    // Determine module and options
    const isHttps = sourceUrl.protocol === 'https:';
    const transport = isHttps ? https : http;
    const upstreamOpts = {
        method: 'GET',
        protocol: sourceUrl.protocol,
        hostname: sourceUrl.hostname,
        port: sourceUrl.port || (isHttps ? 443 : 80),
        path: sourceUrl.pathname + (sourceUrl.search || ''),
        headers: outHeaders,
        timeout: Number(process.env.PROXY_CONNECT_TIMEOUT_MS || 5000)
    };

    try {
        const upstreamReq = transport.request(upstreamOpts, upstreamRes => {
            // Propagate safe subset of headers
            const hopByHop = new Set(['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','upgrade']);
            const headers = {};
            for (const [k,v] of Object.entries(upstreamRes.headers || {})) {
                if (!hopByHop.has(k.toLowerCase())) headers[k] = v;
            }

            res.writeHead(upstreamRes.statusCode || 502, headers);

            const maxBytes = parseInt(process.env.PROXY_MAX_BODY_BYTES || ( (process.env.PROXY_MAX_BODY || '2mb').toLowerCase().endsWith('mb') ? Number(process.env.PROXY_MAX_BODY.replace(/mb/i,'').trim())*1024*1024 : 2*1024*1024 ), 10);
            let bytes = 0;
            const start = Date.now();

            upstreamRes.on('data', chunk => {
                bytes += chunk.length;
                if (bytes > maxBytes) {
                    safeLog('warn', { route: '/books/files', upstream: sourceUrl.hostname, errorCode: 'UPSTREAM_MAX_BYTES' });
                    upstreamReq.destroy();
                    try { res.destroy(); } catch {}
                    return;
                }
                res.write(chunk);
            });
            upstreamRes.on('end', () => {
                const latencyMs = Date.now() - start;
                safeLog('info', { route: '/books/files', upstream: sourceUrl.hostname, status: upstreamRes.statusCode, latencyMs, bytes });
                res.end();
            });
        });

        upstreamReq.on('timeout', () => {
            safeLog('warn', { route: '/books/files', upstream: sourceUrl.hostname, errorCode: 'UPSTREAM_TIMEOUT' });
            upstreamReq.destroy();
            try { res.status(504).json({ error: 'upstream_timeout' }); } catch {}
        });
        upstreamReq.on('error', (err) => {
            safeLog('error', { route: '/books/files', upstream: sourceUrl.hostname, errorCode: 'UPSTREAM_ERROR' });
            try { res.status(502).json({ error: 'upstream_error' }); } catch {}
        });
        upstreamReq.end();
    } catch (err) {
        safeLog('error', { route: '/books/files', upstream: sourceUrl.hostname, errorCode: 'REQUEST_SETUP_ERROR' });
        res.status(500).json({ error: 'internal_error' });
    }
});
app.use("/epoxy/", express.static(epoxyPath));
app.use("/libcurl/", express.static(libcurlPath));
app.use("/baremux/", express.static(baremuxPath));
app.use("/uv/", express.static(uvPath));
app.get("/privacy", privacyRateLimiter, (req, res) => res.sendFile(join(publicPath, "privacy.html")));

app.get("/v1/api/version", (req, res) => {
    if (req.query.v && req.query.v != version) {
        res.status(400).send(version);
        return;
    }
    res.status(200).send(version);
});

app.get("/v1/api/broken-sites", async (req, res) => {
    res.status(200).send(await brokenSites());
})

app.get("/v1/api/search-suggestions", async (req, res) => {
    let response;
    let results = [];
    const query = req.query.query;
    switch (req.headers.engine ?? "google") {
        case "duckduckgo":
            response = await fetch(
                `http://api.duckduckgo.com/ac?q=${query}&format=json`
            ).then((i) => i.json());
            results = response.map(result => result.phrase);
            break;

        case "google":
            response = await fetch(
                `http://suggestqueries.google.com/complete/search?client=firefox&q=${query}`
            ).then((i) => i.json());
            results = response[1];
            break;

        case "yandex":
            response = await fetch(
                `https://suggest.yandex.com/suggest?part=${query}`
            ).then((i) => i.json());
            results = response[1].map(suggestion => suggestion);
            break;

        default:
            res.status(400).send('How?');
            return;
    }

    res.send(results);
});


// AI STUFF

app.use(cookieParser()); 
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || generateSecureToken(32),
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 1000 * 60 * 30,
    path: '/'
  },
  name: 'shadow.session'
}));

// Add security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

const { generateToken, doubleCsrfProtection, validateRequest } = doubleCsrf({
    getSecret: () => process.env.CSRF_SECRET || process.env.SESSION_SECRET || generateSecureToken(32),
    cookieName: "shadow.csrf",
    size: 64,
    cookieOptions: {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/"
    },
    getTokenFromRequest: (req) => req.headers["x-csrf-token"]
});

// Middleware to protect routes
const csrfProtection = (req, res, next) => {
  try {
    validateRequest(req, res);
    next();
  } catch (error) {
    res.status(403).json({
      error: "Invalid CSRF token",
      message: error.message
    });
  }
};

// Apply CSRF protection to state-changing requests, excluding token bootstrap
app.use((req, res, next) => {
  if (req.path === "/csrf-token") return next();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return csrfProtection(req, res, next);
  }
  next();
});

function requireSession(req, res, next) {
  if (req.session?.hasSession) return next();
  res.status(401).json({ error: "Missing or invalid session" });
}

// Route to get CSRF token
app.get('/csrf-token', (req, res) => {
  req.session.hasSession = true;
  res.json({ csrfToken: generateToken(req, res) });
});


const models = ["gpt-5-mini", "shuttle-3.5", "gpt-5"];
app.post('/ask', requireSession, doubleCsrfProtection, async (req, res) => {
    const { messages, model } = req.body;
    const temperature = req.body.temperature || 0.7;
    const max_tokens = req.body.max_tokens || 512;

    if (!Array.isArray(messages)) {
        return res.status(400).json({ error: 'msgs need to be in an array format.' });
    }

    const requestedModel = models.includes(model) ? model : "shuttle-3.5";

    try {
        const response = await fetch("https://api.shuttleai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.SHUTTLEAI_API_KEY}`
            },
            body: JSON.stringify({
                model: requestedModel,
                messages
        })
        });

        const data = await response.json();

        if (!data?.choices?.[0]?.message?.content) {
            console.error("Unexpected response:", data);
            return res.status(500).json({ error: "Unexpected response from AI API" });
        }

        res.json({
            model: requestedModel,
            message: data.choices[0].message.content
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to Retrieve Request" });
    }
});

app.get("/v1/api/user-agents", async (req, res) => {
    let text = await fetch("https://useragents.me/");
    text = await text.text();
    const $ = cheerio.load(text);
    res.send(
        $(
