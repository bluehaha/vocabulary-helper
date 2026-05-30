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

Three placeholders are filled in on the VM during one-time provisioning:
`DOMAIN_PLACEHOLDER`, `BASICAUTH_USER`, `BASICAUTH_HASH`.

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

### 5. Generate basic-auth hash and fill in the Caddyfile

Generate a bcrypt hash of your chosen password:

```sh
docker run --rm caddy:2-alpine caddy hash-password --plaintext 'your-password-here'
```

Copy the hash. SSH to the VM as `deploy` and edit
`/opt/vocabulary-helper/Caddyfile` (which the first deploy will have placed
there) — replace `DOMAIN_PLACEHOLDER`, `BASICAUTH_USER`, and `BASICAUTH_HASH`
with your real values. After future deploys overwrite the file, you'll need
to redo this — see below for the fix.

**To avoid re-editing on every deploy:** once the Caddyfile contents stabilize
on the VM, comment out the `Caddyfile` line in the workflow's `scp` source list
(Task 4 step 1). Or, alternative: keep the placeholders in the repo and add a
`sed` substitution to the workflow that fills them in using
`secrets.DEPLOY_DOMAIN`, `secrets.BASICAUTH_USER`, `secrets.BASICAUTH_HASH`
during the scp-prep step. The hash is not sensitive but the user can be
anything you like.

### 6. ghcr.io login on the VM

Create a GitHub Personal Access Token with `read:packages` scope. On the VM
as `deploy`:

```sh
echo <token> | docker login ghcr.io -u <github-username> --password-stdin
```

### 7. GitHub repo secrets

Add these in **Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `SSH_HOST` | VM's public IP or hostname |
| `SSH_USER` | `deploy` |
| `SSH_KEY` | private key for the `deploy` user |
| `DEPLOY_DOMAIN` | `vocab.example.com` (used by the health check) |
| `HEALTHCHECK_AUTH` | base64 of `user:password` (`echo -n 'user:password' \| base64`) |
| `WORDUP_ACCESS_TOKEN` | WordUp API access token |
| `WORDUP_CLIENT` | WordUp API `client` header |
| `WORDUP_UID` | WordUp API `uid` header |
| `WORDUP_DECK_ID` | WordUp deck ID |

### 8. First deploy

Push a commit to `main` (or trigger the workflow manually via the Actions
tab). On success:

- `https://vocab.example.com/` prompts for basic auth.
- After auth, the search UI loads.
- Look up a word; `https://vocab.example.com/upload` lists it.

If Caddy fails to obtain a cert, check `docker logs caddy` on the VM. Most
common cause: DNS not yet propagated, or ports 80/443 still blocked by
`iptables`.
