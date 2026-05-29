# Deploying vocabulary-helper to Oracle Cloud VM via GitHub Actions

**Date:** 2026-05-29
**Status:** Design — awaiting implementation

## Goal

Run `vocabulary-helper` continuously on an Oracle Cloud VM, reachable over the
public internet at a custom domain with HTTPS, and update it automatically when
new commits land on `main`.

## Constraints and decisions

- **Delivery:** Docker image built by GitHub Actions, pushed to GitHub Container
  Registry (ghcr.io), pulled by the VM.
- **VM state:** blank Oracle Cloud VM (Ubuntu 22.04 LTS, ARM Ampere shape for
  free-tier eligibility). All provisioning is documented here.
- **Networking:** publicly reachable at `vocab.example.com` over HTTPS. Caddy
  terminates TLS (automatic Let's Encrypt) and enforces basic auth in front of
  the app.
- **Persistence:** `data/history.json` lives in a Docker named volume so it
  survives image updates. WordUp credentials live in GitHub Secrets and are
  injected as environment variables at deploy time — never baked into the
  image, never written to disk on the VM.
- **Deploy trigger:** SSH push from GitHub Actions. The VM is passive; the
  workflow drives every update. Rollback is "re-run an older workflow."
- **Domain:** does not yet exist. Acquiring one is a prerequisite (flagged
  in the runbook).

## Architecture

```
   ┌────────────────────┐     git push main      ┌─────────────────────┐
   │  Developer laptop  │ ─────────────────────▶ │ GitHub repo + Actions│
   └────────────────────┘                        └──────────┬──────────┘
                                                            │
                                            (1) docker build & push image
                                                            │
                                                            ▼
                                                  ┌──────────────────┐
                                                  │   ghcr.io        │
                                                  │ vocabulary-helper│
                                                  └────────┬─────────┘
                                                            │
                                            (2) ssh + docker pull/run
                                                            │
                                                            ▼
   ┌────── Oracle Cloud VM (Ubuntu, public IP) ────────────────────────┐
   │                                                                   │
   │   Internet :443 ──▶  Caddy container  ──▶  app container :3000   │
   │                       (TLS + basic auth)     (vocab-helper)       │
   │                                                       │           │
   │                                                       ▼           │
   │                                              Docker named volume  │
   │                                                  (history.json)   │
   └───────────────────────────────────────────────────────────────────┘
```

### Components

- **App container** — Express server, packaged as `ghcr.io/<owner>/vocabulary-helper`.
  Binds to `0.0.0.0:3000` inside the container. Not exposed to the host
  directly; reachable only via Caddy on the internal Docker network.
- **Caddy container** — `caddy:2-alpine`. Owns ports 80 and 443 on the host.
  Terminates TLS (Let's Encrypt), enforces basic auth, reverse-proxies to
  `app:3000`.
- **Named volume `vocab-data`** — mounted into the app container at `/app/data`.
  Stores `history.json` across image updates.
- **Named volumes `caddy_data`, `caddy_config`** — cache Let's Encrypt certs so
  Caddy doesn't re-issue on every restart.

## One-time VM provisioning runbook

This is the work done once on a fresh Oracle Cloud VM. The repo's deploy
workflow assumes all steps below are complete.

### A. Oracle Cloud setup

1. Create a VM instance: Ubuntu 22.04 LTS, ARM Ampere shape (free tier).
2. In the instance's **Virtual Cloud Network → Security List**, add ingress
   rules for TCP **80** and **443** from `0.0.0.0/0`. Oracle's default firewall
   blocks everything except SSH.
3. On the VM, open the same ports in `iptables` (Oracle Ubuntu images ship with
   a restrictive `iptables` config that overrides the cloud-level rules):

   ```sh
   sudo iptables -I INPUT 6 -p tcp -m state --state NEW -m tcp --dport 80  -j ACCEPT
   sudo iptables -I INPUT 6 -p tcp -m state --state NEW -m tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```

### B. Install Docker

1. Install Docker Engine and the Compose plugin via the official Docker apt
   repository (see `https://docs.docker.com/engine/install/ubuntu/`).
2. Create a dedicated `deploy` user and add it to the `docker` group:

   ```sh
   sudo adduser --disabled-password --gecos "" deploy
   sudo usermod -aG docker deploy
   ```

   SSH access for GitHub Actions goes to this user — not `root`, not `ubuntu`.

### C. DNS prerequisite

1. Acquire a domain (Cloudflare, Namecheap, etc.).
2. Add an A record `vocab.example.com → <VM public IP>`.
3. Verify with `dig vocab.example.com` before the first deploy — Caddy will
   fail to obtain a TLS certificate otherwise.

### D. Bootstrap directory and Caddy config

1. Create `/opt/vocabulary-helper/` owned by `deploy`. This directory holds
   `docker-compose.yml` and `Caddyfile`, both of which are checked into the
   repo and copied to the VM on every deploy.
2. Generate a bcrypt-hashed basic-auth password once:

   ```sh
   docker run --rm caddy:2-alpine caddy hash-password --plaintext '<your password>'
   ```

   Place the resulting hash into `deploy/Caddyfile` in the repo.

### E. ghcr.io authentication on the VM

1. Create a GitHub Personal Access Token with `read:packages` scope.
2. On the VM, as `deploy`:

   ```sh
   echo <token> | docker login ghcr.io -u <github-username> --password-stdin
   ```

   The credential is stored in `~/.docker/config.json` and only used for pulls.

### F. GitHub repository secrets

| Secret | Value |
| --- | --- |
| `SSH_HOST` | VM's public IP or hostname |
| `SSH_USER` | `deploy` |
| `SSH_KEY` | private key for the `deploy` user; matching public key in `~deploy/.ssh/authorized_keys` |
| `WORDUP_ACCESS_TOKEN` | WordUp API access token |
| `WORDUP_CLIENT` | WordUp API `client` header |
| `WORDUP_UID` | WordUp API `uid` header |
| `WORDUP_DECK_ID` | WordUp deck ID |
| `HEALTHCHECK_AUTH` | base64-encoded `user:password` used by the workflow's post-deploy curl |

## Repository changes

Four new files. No changes to existing app code beyond one read-from-env tweak
described below.

### 1. `Dockerfile`

- Base: `node:20-alpine` (small, ARM-compatible).
- Install pnpm, copy `package.json` + `pnpm-lock.yaml`, run
  `pnpm install --prod --frozen-lockfile`.
- Copy `server/` and `public/`.
- `EXPOSE 3000`, `CMD ["node", "server/index.js"]`.

**One code change required:** `server/index.js` currently binds to `127.0.0.1`.
Inside a container, the server must bind to `0.0.0.0` so Caddy (in a sibling
container) can reach it. Read the bind address from a `BIND_HOST` env var,
defaulting to `127.0.0.1` so local `pnpm dev` is unchanged. The Dockerfile sets
`ENV BIND_HOST=0.0.0.0`.

### 2. `.dockerignore`

Excludes `node_modules`, `.git`, `data/`, `.env`, `.obsidian/`, `openspec/`,
`docs/` — keeps the image small and prevents the local `.env` from leaking
into the image.

### 3. `deploy/docker-compose.yml`

Two services on a shared Docker network:

- **`app`** — `image: ghcr.io/<owner>/vocabulary-helper:${IMAGE_TAG}`. Env vars
  pulled from the host shell (which the deploy workflow populates with the
  WordUp secrets). Volume `vocab-data:/app/data`. `restart: unless-stopped`.
  No published ports — Caddy reaches it on the internal network.
- **`caddy`** — `image: caddy:2-alpine`. Publishes `80:80` and `443:443`.
  Mounts `./Caddyfile:/etc/caddy/Caddyfile:ro` and the `caddy_data` and
  `caddy_config` named volumes. `restart: unless-stopped`.

Volumes: `vocab-data`, `caddy_data`, `caddy_config`.

### 4. `deploy/Caddyfile`

About 10 lines:

```
vocab.example.com {
    basicauth {
        <user> <bcrypt-hash>
    }
    reverse_proxy app:3000
}
```

The bcrypt hash is committed (it's a hash, not the plaintext). The domain is
hardcoded; changing it means editing one line and redeploying.

## GitHub Actions workflow

One file: `.github/workflows/deploy.yml`. Triggers on push to `main` and on
`workflow_dispatch` (manual).

### Job 1 — `build-and-push`

Runner: `ubuntu-latest`.

1. `actions/checkout@v4`.
2. `docker/setup-qemu-action` and `docker/setup-buildx-action` — required to
   cross-build `linux/arm64` images from an x86 runner.
3. `docker/login-action` to `ghcr.io` using `secrets.GITHUB_TOKEN` (built-in,
   has package-write permission scoped to this repo).
4. `docker/build-push-action`:
   - Platform: `linux/arm64`.
   - Tags: `ghcr.io/<owner>/vocabulary-helper:latest` AND
     `ghcr.io/<owner>/vocabulary-helper:${{ github.sha }}`.
   - Push: true.

The SHA tag is what enables rollback by re-running an older workflow.

### Job 2 — `deploy`

Runner: `ubuntu-latest`. Depends on `build-and-push` (`needs:`).

1. `actions/checkout@v4` — to get `deploy/docker-compose.yml` and
   `deploy/Caddyfile`.
2. Install the SSH private key from `secrets.SSH_KEY` into `~/.ssh/id_ed25519`
   on the runner; add the VM to `known_hosts` using
   `ssh-keyscan ${{ secrets.SSH_HOST }}`.
3. `scp -r deploy/* deploy@$SSH_HOST:/opt/vocabulary-helper/` — keeps the
   compose file and Caddyfile in sync with the repo on every deploy.
4. SSH to the VM and run:

   ```sh
   cd /opt/vocabulary-helper
   export IMAGE_TAG=${{ github.sha }}
   export WORDUP_ACCESS_TOKEN=${{ secrets.WORDUP_ACCESS_TOKEN }}
   export WORDUP_CLIENT=${{ secrets.WORDUP_CLIENT }}
   export WORDUP_UID=${{ secrets.WORDUP_UID }}
   export WORDUP_DECK_ID=${{ secrets.WORDUP_DECK_ID }}
   docker compose pull app
   docker compose up -d
   docker image prune -f
   ```

5. **Health check** — from the runner, poll
   `https://vocab.example.com/api/history` with the
   `Authorization: Basic ${{ secrets.HEALTHCHECK_AUTH }}` header, up to 30s.
   Fail the job if a 200 response never arrives. Without this the workflow
   goes green even when the app crashlooped.

## Rollback

Every image is tagged with its commit SHA. To roll back:

- **Easy path:** find an older successful workflow run in the GitHub UI →
  click "Re-run all jobs." It redeploys that SHA's image.
- **Manual path:** SSH to the VM and run
  `IMAGE_TAG=<sha> docker compose up -d` with an older SHA.

## Out of scope (deliberately omitted)

- No staging environment. Personal tool, one VM.
- No blue/green or zero-downtime deploys. A ~2-second blip during container
  restart is acceptable.
- No automated backups of `history.json`. The README notes this file is fine
  to lose.
- No monitoring or alerting. Caddy logs to its container stdout;
  `docker logs caddy` and `docker logs app` are the diagnostic surface.

## Success criteria

1. A push to `main` results in `https://vocab.example.com/` serving the new
   build within ~3 minutes, with no manual intervention on the VM.
2. The site requires basic auth and serves a valid Let's Encrypt certificate.
3. `data/history.json` survives image updates (verified by adding a word,
   redeploying, and confirming the word is still in history).
4. Rolling back via "re-run an older workflow" reliably restores the previous
   image.
5. No WordUp credentials appear in the built image, the repo, or the VM's
   filesystem (only in GitHub Secrets and in the live container's process
   environment).
