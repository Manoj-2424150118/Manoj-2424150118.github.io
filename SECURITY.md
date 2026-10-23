# Security Policy

## About this site

This is a **static** portfolio hosted on GitHub Pages. It has:

- No server-side code, no database, no login, no forms, no cookies, no trackers
- No third-party scripts or external requests — every script, style, font and image is served from this repository
- A strict Content-Security-Policy (delivered via `<meta>`, the mechanism GitHub Pages supports): `default-src 'self'`, scripts and styles only from this origin or pinned by SHA-256 hash, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`
- Anti-clickjacking frame-busting (`anti-clickjack.js`)
- HTTPS enforced by GitHub Pages

## Reporting a vulnerability

If you find a security issue with this website, please email **sharmamanojkumar697@gmail.com** with details. You can also use GitHub's private vulnerability reporting on this repository. Please do not open a public issue for an undisclosed vulnerability.

## Scope notes (honest limits)

- HTTP security headers such as `X-Frame-Options` can only be sent by the hosting platform; GitHub Pages does not support custom headers, and the `_headers` file in this repo is **not** read by GitHub Pages — it is kept ready for a future move to a host that supports it (e.g. Cloudflare Pages / Netlify, or Cloudflare in front of a custom domain, which would also enable WAF rules and IP-based blocking).
- Repository integrity is protected by GitHub branch protection on `main` (no force pushes, no branch deletion) and secret-scanning push protection.
- An automated security check (`.github/workflows/security-check.yml`) runs on every push and weekly against the live site, and fails if the strict CSP, anti-clickjacking, or content-integrity markers regress.
