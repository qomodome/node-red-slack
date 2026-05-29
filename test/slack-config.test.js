const test = require("node:test");
const assert = require("node:assert/strict");

const slackConfigModule = require("../nodes/slack-config");

function buildRedMock() {
  const registry = {};

  return {
    registry,
    nodes: {
      createNode(node, config) {
        node.id = "node-id";
        node.type = "slack-config";
        node.name = config.name;
      },
      registerType(type, ctor, opts) {
        registry[type] = { ctor, opts };
      }
    }
  };
}

test("registers slack-config node with password credentials", () => {
  const RED = buildRedMock();

  slackConfigModule(RED);

  assert.ok(RED.registry["slack-config"]);
  assert.deepEqual(RED.registry["slack-config"].opts, {
    credentials: {
      token: { type: "password" }
    }
  });
});

test("getToken returns trimmed token and empty string when missing", () => {
  const RED = buildRedMock();
  slackConfigModule(RED);

  const SlackConfigCtor = RED.registry["slack-config"].ctor;
  const node = new SlackConfigCtor({ name: "Workspace" });

  node.credentials = { token: "   xoxb-abc123   " };
  assert.equal(node.getToken(), "xoxb-abc123");

  node.credentials = {};
  assert.equal(node.getToken(), "");

  node.credentials = { token: null };
  assert.equal(node.getToken(), "");
});
