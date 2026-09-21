# Security Policy

## Supported versions

The `main` branch is the supported release line. Security fixes are applied to the latest committed version; users should rebuild from the latest `main` commit before reporting a previously fixed issue.

## Reporting a vulnerability

Please do not disclose suspected vulnerabilities in a public issue. Use the repository’s [private vulnerability reporting form](https://github.com/daddyfilth/Fishfinder-pro/security/advisories/new) and include the affected route or component, reproduction steps, impact, and any suggested mitigation. Remove credentials, access tokens, personal data, and production URLs from the report unless they are essential to reproducing the issue.

Reports are triaged privately. The maintainer will acknowledge receipt when practical, investigate the report, coordinate a fix or mitigation, and publish a security advisory when disclosure is appropriate. Do not test against accounts, data, or infrastructure that you do not own or have explicit permission to assess.

## Security expectations

Production secrets must be supplied through deployment secrets or environment variables and must never be committed to the repository. The application relies on Supabase Row Level Security, server-side authorization checks, same-origin protections for state-changing routes, and rate limiting for authentication, data writes, and AI/provider-backed endpoints. These controls should remain enabled in production.
