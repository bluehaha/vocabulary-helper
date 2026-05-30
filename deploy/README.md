# deploy/

Files in this directory are copied to `/opt/vocabulary-helper/` on the VM by
the GitHub Actions deploy workflow.

## docker-compose.yml

Defines the `app` (vocabulary-helper) and `caddy` services. The `OWNER` token
in the image reference is substituted by the deploy workflow with the GitHub
repository owner.

Environment variables expected at `docker compose up` time:

- `IMAGE_TAG` — the image tag to pull (commit SHA in deploys; `latest` for
  manual runs on the VM).
- `WORDUP_ACCESS_TOKEN`, `WORDUP_CLIENT`, `WORDUP_UID`, `WORDUP_DECK_ID` —
  WordUp API credentials.
- `DICTIONARY_LANG` — optional, defaults to `en-tw`.

## Caddyfile

The placeholders (`DOMAIN_PLACEHOLDER`, `BASICAUTH_USER`, `BASICAUTH_HASH`)
are filled in on the VM during one-time provisioning. See the design doc:
`docs/superpowers/specs/2026-05-29-oracle-vm-deploy-design.md`.
