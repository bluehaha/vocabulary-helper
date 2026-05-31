# deploy/

Files in this directory are copied to `/opt/vocabulary-helper/` on the VM by
the GitHub Actions deploy workflow.

## docker-compose.yml

Defines the `app` (vocabulary-helper) and `caddy` services. The `OWNER` token
in the image reference is substituted by the deploy workflow with the GitHub
repository owner.

Environment variables expected at `docker compose up` time:

- `IMAGE_TAG` — the image tag to pull (commit SHA in deploys; `latest` for
  manual runs on the VM). Exported by the deploy workflow via SSH.
- `WORDUP_ACCESS_TOKEN`, `WORDUP_CLIENT`, `WORDUP_UID`, `WORDUP_DECK_ID` —
  WordUp API credentials. Read from `/opt/vocabulary-helper/.env`, which
  Docker Compose auto-loads. Maintained on the VM, not in GitHub secrets.
- `DICTIONARY_LANG` — optional, defaults to `en-tw`. Also lives in `.env`.

## Caddyfile

Uses Caddy's `{$VAR}` substitution. `DEPLOY_DOMAIN`, `BASICAUTH_USER`, and
`BASICAUTH_HASH` are read from `/opt/vocabulary-helper/.env` on the VM (Docker
Compose passes them to the `caddy` container, and Caddy expands them at
config-load time). No editing of the Caddyfile on the VM is needed.

## Run locally with Docker + Caddy

Use this to exercise the same `app` + `caddy` topology on your machine without
TLS, basic auth, or a real domain.

### 1. Create `deploy/.env`

Docker Compose auto-loads `.env` from the directory where you run
`docker compose`. Create `deploy/.env` with WordUp credentials (or leave them
blank if you only need lookup):

```sh
cat > deploy/.env <<'EOF'
WORDUP_ACCESS_TOKEN=
WORDUP_CLIENT=
WORDUP_UID=
WORDUP_DECK_ID=
DICTIONARY_LANG=en-tw
IMAGE_TAG=local
EOF
```

### 2. Create `deploy/Caddyfile.local`

```
:80 {
    reverse_proxy app:3000
}
```

Local Caddy can't get a Let's Encrypt cert, so we serve plain HTTP and skip
basic auth for convenience.

### 3. Create `deploy/docker-compose.override.yml`

Compose auto-merges this on top of `docker-compose.yml`, so the production
file stays untouched:

```yaml
services:
  app:
    image: vocabulary-helper:local
    build:
      context: ..
      dockerfile: Dockerfile
  caddy:
    ports: !override
      - "8080:80"
    volumes: !override
      - ./Caddyfile.local:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
```

Port 8080 avoids clashing with anything else on `:80`. `!override` replaces
the production lists rather than appending to them.

### 4. Run

```sh
cd deploy
docker compose up --build
```

Open `http://localhost:8080/` for the search UI and
`http://localhost:8080/upload` for the upload queue.

Stop with `Ctrl-C`, or `docker compose down` to remove containers. Add `-v`
to also wipe the `vocab-data` volume (your local lookup history).

## One-time VM provisioning

Do these steps ONCE on a fresh Oracle Cloud VM. The deploy workflow assumes
all of them are complete.

### 1. Oracle Cloud setup

- Create a VM instance: Ubuntu 22.04 LTS, ARM Ampere shape (free tier).
- In the instance's **Virtual Cloud Network → Security List**, add ingress
  rules for TCP **80** and **443** from `0.0.0.0/0`.
- On the VM, open the same ports in `iptables`:

  ```sh
  sudo iptables -I INPUT 6 -p tcp -m state --state NEW -m tcp --dport 80  -j ACCEPT
  sudo iptables -I INPUT 6 -p tcp -m state --state NEW -m tcp --dport 443 -j ACCEPT
  sudo netfilter-persistent save
  ```

### 2. Install Docker

Follow `https://docs.docker.com/engine/install/ubuntu/` (Engine + Compose
plugin).

Create the `deploy` user:

```sh
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
```

Add your GitHub Actions public key (the one matching the private `SSH_KEY`
secret) to `/home/deploy/.ssh/authorized_keys`. Confirm `chmod 700 ~/.ssh`
and `chmod 600 ~/.ssh/authorized_keys` for that user.

### 3. DNS

- Acquire a domain (e.g. via Cloudflare or Namecheap).
- Add an A record `vocab.example.com → <VM public IP>`.
- Verify with `dig vocab.example.com` before the first deploy. Caddy needs
  this to obtain a TLS cert.

### 4. Bootstrap `/opt/vocabulary-helper/`

```sh
sudo mkdir -p /opt/vocabulary-helper
sudo chown deploy:deploy /opt/vocabulary-helper
```

### 5. Create `/opt/vocabulary-helper/.env`

As the `deploy` user, create `/opt/vocabulary-helper/.env` with the WordUp
credentials. Docker Compose auto-loads this file on `docker compose up`.

```sh
cat > /opt/vocabulary-helper/.env <<'EOF'
WORDUP_ACCESS_TOKEN=...
WORDUP_CLIENT=...
WORDUP_UID=...
WORDUP_DECK_ID=...
# Optional, defaults to en-tw
# DICTIONARY_LANG=en-tw

# Caddy site config (see step 6 for BASICAUTH_HASH)
DEPLOY_DOMAIN=vocab.example.com
BASICAUTH_USER=youruser
BASICAUTH_HASH='$2a$14$...'
EOF
chmod 600 /opt/vocabulary-helper/.env
```

Quote `BASICAUTH_HASH` in single quotes — bcrypt hashes contain `$` which
Docker Compose would otherwise try to interpolate.

The deploy workflow fails fast if this file is missing. To rotate WordUp
credentials later: SSH in, edit `.env`, then run `docker compose up -d` from
`/opt/vocabulary-helper/`.

### 6. Generate basic-auth hash

Generate a bcrypt hash of your chosen password:

```sh
docker run --rm caddy:2-alpine caddy hash-password --plaintext 'your-password-here'
```

Copy the hash into `/opt/vocabulary-helper/.env` as `BASICAUTH_HASH` (see
step 5). Caddy reads it via `{$BASICAUTH_HASH}` at startup — no editing of
the Caddyfile on the VM is needed, and future deploys won't clobber anything.

### 7. ghcr.io login on the VM

Create a GitHub Personal Access Token with `read:packages` scope. On the VM
as `deploy`:

```sh
echo <token> | docker login ghcr.io -u <github-username> --password-stdin
```

### 8. GitHub repo secrets

Add these in **Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `SSH_HOST` | VM's public IP or hostname |
| `SSH_USER` | `deploy` |
| `SSH_KEY` | private key for the `deploy` user |
| `DEPLOY_DOMAIN` | `vocab.example.com` (used by the health check) |
| `HEALTHCHECK_AUTH` | base64 of `user:password` (`echo -n 'user:password' \| base64`) |

WordUp credentials are read from `/opt/vocabulary-helper/.env` on the VM
(step 5), not from GitHub secrets.

### 9. First deploy

Push a commit to `main` (or trigger the workflow manually via the Actions
tab). On success:

- `https://vocab.example.com/` prompts for basic auth.
- After auth, the search UI loads.
- Look up a word; `https://vocab.example.com/upload` lists it.

If Caddy fails to obtain a cert, check `docker logs caddy` on the VM. Most
common cause: DNS not yet propagated, or ports 80/443 still blocked by
`iptables`.
