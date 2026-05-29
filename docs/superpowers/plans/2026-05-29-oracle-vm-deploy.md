# Oracle VM + GitHub Actions Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `vocabulary-helper` from a push to `main` to a live HTTPS URL on an Oracle Cloud VM with no manual intervention, using GitHub Actions to build/push a Docker image to ghcr.io and SSH into the VM to deploy it.

**Architecture:** App runs as a Docker container behind a Caddy reverse proxy (TLS + basic auth). State (`history.json`) lives in a Docker named volume. Secrets are injected at container start from GitHub Secrets, never baked into the image or written to the VM filesystem. Every image is tagged by commit SHA so rollback is "re-run an older workflow."

**Tech Stack:** Node.js 20 (alpine), Docker + Docker Compose, Caddy 2, GitHub Actions (`docker/build-push-action`, `appleboy/ssh-action`), ghcr.io.

**Reference spec:** `docs/superpowers/specs/2026-05-29-oracle-vm-deploy-design.md`

---

## File Structure

**New files (in repo):**
- `Dockerfile` — image definition
- `.dockerignore` — exclude local-only paths from build context
- `deploy/docker-compose.yml` — defines `app` + `caddy` services on the VM
- `deploy/Caddyfile` — TLS + basic auth + reverse proxy config
- `.github/workflows/deploy.yml` — build-and-push + ssh-deploy jobs

**Modified files:**
- `server/index.js:12` — read bind host from `BIND_HOST` env var (default preserves current local-dev behavior)
- `.env.example` — document the new `BIND_HOST` variable
- `README.md` — add a "Deployment" section pointing to the spec

**No changes to:** `server/cambridge.js`, `server/history.js`, `server/wordup.js`, `public/*`, `data/*`, `package.json`, `pnpm-lock.yaml`.

---

## Task 1: Make the server bind address configurable

The server currently hard-codes `127.0.0.1`. Inside a container, Caddy in a sibling container can't reach `127.0.0.1`. We make the bind host an env var, defaulting to `127.0.0.1` so `pnpm dev` is unchanged. The Dockerfile (Task 2) sets `BIND_HOST=0.0.0.0`.

**Files:**
- Modify: `server/index.js:12`
- Modify: `.env.example`

- [ ] **Step 1: Change the bind host to read from env**

Replace the line at `server/index.js:12`:

```js
const HOST = "127.0.0.1";
```

With:

```js
const HOST = process.env.BIND_HOST || "127.0.0.1";
```

Leave the `app.listen(PORT, HOST, ...)` call and the `console.log` unchanged — they already use the `HOST` variable.

- [ ] **Step 2: Document the new env var in `.env.example`**

Append to `.env.example`:

```
BIND_HOST=127.0.0.1
```

- [ ] **Step 3: Verify local dev still works**

Run from the repo root:

```sh
pnpm start
```

Expected output:

```
vocabulary-helper running at http://127.0.0.1:3000
```

(Or whatever `PORT` is set to.) Hit `Ctrl+C` to stop. If the bound host isn't `127.0.0.1`, the change is wrong.

- [ ] **Step 4: Verify the override works**

Run:

```sh
BIND_HOST=0.0.0.0 pnpm start
```

Expected output:

```
vocabulary-helper running at http://0.0.0.0:3000
```

`Ctrl+C` to stop.

- [ ] **Step 5: Commit**

```sh
git add server/index.js .env.example
git commit -m "feat(server): make bind host configurable via BIND_HOST"
```

---

## Task 2: Add Dockerfile and .dockerignore

Builds the image we'll push to ghcr.io. Uses pnpm (the project's package manager) and a `--prod --frozen-lockfile` install. Sets `BIND_HOST=0.0.0.0` so the server is reachable inside the Docker network.

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Create `.dockerignore`**

Write to `.dockerignore`:

```
node_modules
.git
.gitignore
data
.env
.env.*
!.env.example
.obsidian
openspec
docs
README.md
.claude
```

This keeps the build context small and prevents the local `.env` (which contains real WordUp credentials) from being copied into the image.

- [ ] **Step 2: Create `Dockerfile`**

Write to `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm@11.3.0

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY server ./server
COPY public ./public

ENV BIND_HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/index.js"]
```

- [ ] **Step 3: Build the image locally**

Run:

```sh
docker build -t vocabulary-helper:test .
```

Expected: build succeeds, ends with `Successfully tagged vocabulary-helper:test` (or the buildkit equivalent — a line containing `naming to docker.io/library/vocabulary-helper:test`).

- [ ] **Step 4: Run the image locally and verify it responds**

Run:

```sh
docker run --rm -d --name vh-test -p 3000:3000 vocabulary-helper:test
sleep 2
curl -s http://localhost:3000/api/history
docker stop vh-test
```

Expected: the `curl` returns `{"words":[]}` (or a non-empty list if you happen to have a mounted history file — you won't here, no volume is mounted). Anything other than valid JSON means the container isn't binding correctly.

- [ ] **Step 5: Commit**

```sh
git add Dockerfile .dockerignore
git commit -m "feat: add Dockerfile for production container image"
```

---

## Task 3: Add docker-compose and Caddyfile

These files live in `deploy/` in the repo and get copied to `/opt/vocabulary-helper/` on the VM during deploy. They define the runtime topology (app + Caddy on a shared network) and the TLS/auth config.

**Files:**
- Create: `deploy/docker-compose.yml`
- Create: `deploy/Caddyfile`
- Create: `deploy/README.md` (operator notes — what to fill in before first deploy)

- [ ] **Step 1: Create `deploy/docker-compose.yml`**

Write to `deploy/docker-compose.yml`:

```yaml
services:
  app:
    image: ghcr.io/OWNER/vocabulary-helper:${IMAGE_TAG:-latest}
    restart: unless-stopped
    environment:
      WORDUP_ACCESS_TOKEN: ${WORDUP_ACCESS_TOKEN}
      WORDUP_CLIENT: ${WORDUP_CLIENT}
      WORDUP_UID: ${WORDUP_UID}
      WORDUP_DECK_ID: ${WORDUP_DECK_ID}
      DICTIONARY_LANG: ${DICTIONARY_LANG:-en-tw}
      PORT: "3000"
      BIND_HOST: "0.0.0.0"
    volumes:
      - vocab-data:/app/data
    networks:
      - web

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - web

networks:
  web:

volumes:
  vocab-data:
  caddy_data:
  caddy_config:
```

**Operator note:** Before this file is copied to the VM, the `OWNER` token in the image reference must be replaced with the actual GitHub username/org. The deploy workflow (Task 4) does this substitution.

- [ ] **Step 2: Create `deploy/Caddyfile`**

Write to `deploy/Caddyfile`:

```
DOMAIN_PLACEHOLDER {
    basicauth {
        BASICAUTH_USER BASICAUTH_HASH
    }
    reverse_proxy app:3000
}
```

**Operator note:** `DOMAIN_PLACEHOLDER`, `BASICAUTH_USER`, and `BASICAUTH_HASH` are substituted on the VM during one-time provisioning (Task 5). They're not workflow secrets because the domain and bcrypt hash are not sensitive (the hash, not the password), and committing the real domain into the repo is fine for a personal tool — but keeping them as placeholders keeps this file useful as a template.

- [ ] **Step 3: Create `deploy/README.md`**

Write to `deploy/README.md`:

```markdown
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
```

- [ ] **Step 4: Sanity-check the compose file syntax**

Run from the repo root:

```sh
docker compose -f deploy/docker-compose.yml config > /dev/null
```

Expected: no output, exit code 0. (Warnings about missing env vars are fine — we're checking syntax, not running it.)

- [ ] **Step 5: Commit**

```sh
git add deploy/
git commit -m "feat: add docker-compose and Caddyfile for VM deployment"
```

---

## Task 4: Add the GitHub Actions deploy workflow

One workflow file, two jobs: build-and-push (cross-builds `linux/arm64` and pushes to ghcr.io) and deploy (SSHes to the VM, syncs `deploy/` files, runs `docker compose up`, health-checks).

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create the workflow**

Write to `.github/workflows/deploy.yml`:

```yaml
name: deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  IMAGE_NAME: ghcr.io/${{ github.repository_owner }}/vocabulary-helper

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to ghcr.io
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/arm64
          push: true
          tags: |
            ${{ env.IMAGE_NAME }}:latest
            ${{ env.IMAGE_NAME }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Substitute repo owner into compose file
        run: |
          sed -i "s|ghcr.io/OWNER/|ghcr.io/${{ github.repository_owner }}/|g" deploy/docker-compose.yml

      - name: Copy deploy files to VM
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_KEY }}
          source: "deploy/docker-compose.yml,deploy/Caddyfile"
          target: "/opt/vocabulary-helper/"
          strip_components: 1
          overwrite: true

      - name: Pull image and restart on VM
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_KEY }}
          envs: IMAGE_TAG,WORDUP_ACCESS_TOKEN,WORDUP_CLIENT,WORDUP_UID,WORDUP_DECK_ID
          script: |
            set -e
            cd /opt/vocabulary-helper
            export IMAGE_TAG=$IMAGE_TAG
            export WORDUP_ACCESS_TOKEN=$WORDUP_ACCESS_TOKEN
            export WORDUP_CLIENT=$WORDUP_CLIENT
            export WORDUP_UID=$WORDUP_UID
            export WORDUP_DECK_ID=$WORDUP_DECK_ID
            docker compose pull app
            docker compose up -d
            docker image prune -f
        env:
          IMAGE_TAG: ${{ github.sha }}
          WORDUP_ACCESS_TOKEN: ${{ secrets.WORDUP_ACCESS_TOKEN }}
          WORDUP_CLIENT: ${{ secrets.WORDUP_CLIENT }}
          WORDUP_UID: ${{ secrets.WORDUP_UID }}
          WORDUP_DECK_ID: ${{ secrets.WORDUP_DECK_ID }}

      - name: Health check
        run: |
          set -e
          DEADLINE=$(( $(date +%s) + 30 ))
          while [ $(date +%s) -lt $DEADLINE ]; do
            STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
              -H "Authorization: Basic ${{ secrets.HEALTHCHECK_AUTH }}" \
              "https://${{ secrets.DEPLOY_DOMAIN }}/api/history" || echo "000")
            if [ "$STATUS" = "200" ]; then
              echo "Health check passed (HTTP 200)"
              exit 0
            fi
            echo "Health check returned $STATUS, retrying..."
            sleep 3
          done
          echo "Health check failed: never received HTTP 200 within 30s"
          exit 1
```

**Note on the `appleboy/ssh-action` env passing:** the action requires you to both declare `envs:` (so it forwards them into the SSH session) AND set them in the step's `env:` block (so they exist on the runner in the first place). Both blocks are necessary.

**Note on `DEPLOY_DOMAIN` and `HEALTHCHECK_AUTH`:** these are GitHub repo secrets, added in Task 5. `DEPLOY_DOMAIN` is something like `vocab.example.com`. `HEALTHCHECK_AUTH` is the base64 of `user:password` matching what's in the Caddyfile.

- [ ] **Step 2: Validate the workflow file syntax**

If you have `act` or `actionlint` installed, run it. Otherwise, do a manual review: confirm every `${{ }}` references either a built-in (`github.*`, `secrets.*`) or an env var declared in scope.

A cheap syntax check without extra tools:

```sh
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))" && echo OK
```

Expected: `OK`.

- [ ] **Step 3: Commit**

```sh
git add .github/workflows/deploy.yml
git commit -m "feat(ci): add GitHub Actions workflow to build and deploy"
```

---

## Task 5: Document the one-time VM provisioning runbook in `deploy/README.md`

The provisioning steps live in the spec, but having a concise checklist in `deploy/README.md` makes them findable from the directory the deploy files live in. This is a docs-only change — nothing executable.

**Files:**
- Modify: `deploy/README.md`

- [ ] **Step 1: Expand `deploy/README.md` with the provisioning runbook**

Replace the existing contents of `deploy/README.md` with:

````markdown
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
````

- [ ] **Step 2: Commit**

```sh
git add deploy/README.md
git commit -m "docs(deploy): add one-time VM provisioning runbook"
```

---

## Task 6: Mention deployment in the project README

Single small addition so anyone landing on the repo can find the deploy story.

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Append a "Deployment" section to `README.md`**

Append to `README.md` (after the existing "Notes" section, no other changes):

```markdown

## Deployment

Production deployment to an Oracle Cloud VM is automated via GitHub Actions
(`.github/workflows/deploy.yml`). See:

- Design: `docs/superpowers/specs/2026-05-29-oracle-vm-deploy-design.md`
- One-time VM setup: `deploy/README.md`
```

- [ ] **Step 2: Commit**

```sh
git add README.md
git commit -m "docs: link deployment design and runbook from README"
```

---

## Verification (after all tasks merged and one-time provisioning done)

The implementation is "done" when all of these are true. Verify them in order — earlier failures usually cause later ones.

- [ ] `git push` to `main` triggers the workflow; both jobs (`build-and-push` and `deploy`) go green.
- [ ] `https://<your-domain>/` returns a basic-auth prompt; correct credentials show the search UI.
- [ ] `curl -s -u user:pass https://<your-domain>/api/history` returns valid JSON.
- [ ] On the VM, `docker ps` shows both `app` and `caddy` containers as `Up`.
- [ ] On the VM, `docker volume ls` shows `vocab-data`, `caddy_data`, `caddy_config`.
- [ ] Look up a word via the UI; redeploy the workflow; confirm the word still appears in the upload queue (history persistence works across deploys).
- [ ] In the Actions tab, re-running an older workflow's `deploy` job redeploys the previous image (look at `docker images` on the VM after — the running tag should match the older SHA).
- [ ] On the VM, `cat ~/.docker/config.json` and `cat /opt/vocabulary-helper/docker-compose.yml` contain NO WordUp credentials. `docker exec <app-container> env` does show them (they're in the live process env, which is fine).
