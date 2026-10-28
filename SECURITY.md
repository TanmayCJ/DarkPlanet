# Security policy

Darksite is a static, client-side page. It has no server, accounts or user data. It stores your view settings and chosen site in your own browser's `localStorage`, and it loads one script (Astronomy Engine) from jsDelivr and fonts from Google Fonts.

The kinds of issue we would still treat as security problems:

- A way to make the page run script supplied by someone else, for example through crafted catalogue data or a stored setting
- A supply-chain concern with a pinned dependency or data source
- A build or CI workflow that could be abused

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private reporting instead: go to the repository's **Security** tab, choose **Report a vulnerability**, and describe the problem, how to reproduce it, and its impact.

We aim to acknowledge reports within a week and to fix confirmed issues as quickly as we reasonably can. We will credit you in the release notes unless you would rather stay anonymous.

## Supported versions

Only the latest release on `main` receives fixes.
