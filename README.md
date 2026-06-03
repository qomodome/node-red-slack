# node-red-slack

Node-RED nodes to call Slack Web API methods with a reusable bot token config.

## What you get

- `slack-config`: stores one Slack bot token (`xoxb-...`) and reuses it across flows.
- `slack-api`: generic Slack API caller.
- No runtime dependencies outside Node.js built-ins.

## Requirements

- Node.js 18+
- Node-RED 3+
- A Slack bot token with the scopes required by the API methods you call

## Installation

From the Node-RED editor:

1. Go to `Manage palette` > `Install` tab
2. Search for `@qomodome/node-red-slack`
3. Click `Install`

From the command line:

```bash
npm install @qomodome/node-red-slack
```

## Use the node

1. Add a `slack-config` node and set your bot token.
2. Add a `slack-api` node and link it to that config.
3. Send a message where:

```js
msg.topic = "chat.postMessage";
msg.payload = {
  channel: "#my-channel",
  text: "Hello from Node-RED"
};
return msg;
```

If `msg.topic` is missing, `slack-api` uses its `Default Method` field.

## Node reference

### slack-config

- `name` (optional): label in editor
- `token` (required): Slack bot token

### slack-api

- `slack config` (required): reference to `slack-config`
- `default method` (optional): fallback method when `msg.topic` is empty
- `default channel` (optional): fallback channel when `msg.payload.channel` is missing or empty

## Message contract

Input:

- `msg.topic` (string): Slack method, for example `chat.postMessage`
- `msg.payload` (object): request body sent to Slack
- `msg.payload.channel` (optional): if provided, overrides the node `default channel`

Output on success:

- `msg.payload`: Slack response body (parsed JSON when possible)
- `msg.slack`:
  - `method`
  - `statusCode`
  - `ok`

Error behavior:

- Emits `node.error(err, msg)` and calls `done(err)`
- Fails when config/token/method is missing
- Fails when `msg.payload` is not an object
- Fails on HTTP status `>= 400`
- Fails when Slack responds with `ok: false`
- No built-in retry/backoff

Use Node-RED `catch` nodes and your own flow logic for retries and recovery.

## Local Docker run

From repository root:

```bash
docker compose up --build
```

Then open:

```text
http://localhost:1880
```

Notes:

- This setup auto-installs the local module into `/data/node_modules`.
- Flows persist in a named Docker volume mounted at `/data`.
- Rebuild after source changes:

```bash
docker compose up --build --force-recreate
```

## Development

Run tests:

```bash
npm test
```

Create package tarball:

```bash
npm pack
```

## Publishing

The publish process is automated via GitHub Actions when pushing a tag that matches the `package.json` version. To publish a new version:

```bash
npm version X.Y.Z
git push origin main vX.Y.Z
```

For manual publish (not recommended - use only for emergencies):

0. Verify you have an npm account and are logged in with `npm whoami`. If not, run `npm login --scope=@qomodome --auth-type=web` and follow the prompts.
1. Update version in `package.json`
2. Verify contents with `npm pack --dry-run`
3. Publish to npm:

```bash
npm publish --access public
```

## License

MIT License. See [LICENSE](./LICENSE) for details.
