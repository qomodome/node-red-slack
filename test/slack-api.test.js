const test = require("node:test");
const assert = require("node:assert/strict");
const EventEmitter = require("node:events");
const https = require("node:https");

const slackApiModule = require("../nodes/slack-api");

function buildRedMock(slackConfigNode) {
  const registry = {};

  return {
    registry,
    nodes: {
      createNode(node) {
        const emitter = new EventEmitter();
        node.on = emitter.on.bind(emitter);
        node.emit = emitter.emit.bind(emitter);
        node.send = () => {};
        node.errorCalls = [];
        node.statusCalls = [];
        node.error = (err) => {
          node.errorCalls.push(err);
        };
        node.status = (status) => {
          node.statusCalls.push(status);
        };
      },
      getNode() {
        return slackConfigNode;
      },
      registerType(type, ctor) {
        registry[type] = ctor;
      }
    }
  };
}

function mockHttpsRequest(implementation) {
  const original = https.request;
  https.request = implementation;
  return function restore() {
    https.request = original;
  };
}

async function invokeNode(node, msg) {
  return new Promise((resolve) => {
    let sent;
    node.emit("input", msg, (nextMsg) => {
      sent = nextMsg;
    }, (err) => {
      resolve({ err, sent });
    });
  });
}

test("calls Slack API and returns parsed response in msg.payload", async () => {
  const restoreHttps = mockHttpsRequest((options, callback) => {
    assert.equal(options.path, "/api/chat.postMessage");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, "Bearer xoxb-token");

    const response = new EventEmitter();
    response.statusCode = 200;

    const request = new EventEmitter();
    request.write = (body) => {
      assert.equal(body, JSON.stringify({ channel: "#chan", text: "hello" }));
    };
    request.end = () => {
      callback(response);
      response.emit("data", JSON.stringify({ ok: true, ts: "1.23" }));
      response.emit("end");
    };

    return request;
  });

  const RED = buildRedMock({ getToken: () => "xoxb-token" });
  slackApiModule(RED);

  const SlackApiCtor = RED.registry["slack-api"];
  const node = new SlackApiCtor({ name: "Slack", method: "", slack: "cfg-id" });

  const { err, sent } = await invokeNode(node, {
    topic: "chat.postMessage",
    payload: { channel: "#chan", text: "hello" }
  });

  restoreHttps();

  assert.equal(err, undefined);
  assert.ok(sent);
  assert.deepEqual(sent.payload, { ok: true, ts: "1.23" });
  assert.deepEqual(sent.slack, {
    method: "chat.postMessage",
    statusCode: 200,
    ok: true
  });
  assert.equal(node.errorCalls.length, 0);
});

test("uses default method when msg.topic is missing", async () => {
  const restoreHttps = mockHttpsRequest((options, callback) => {
    assert.equal(options.path, "/api/chat.postMessage");

    const response = new EventEmitter();
    response.statusCode = 200;

    const request = new EventEmitter();
    request.write = () => {};
    request.end = () => {
      callback(response);
      response.emit("data", JSON.stringify({ ok: true }));
      response.emit("end");
    };

    return request;
  });

  const RED = buildRedMock({ getToken: () => "xoxb-token" });
  slackApiModule(RED);

  const SlackApiCtor = RED.registry["slack-api"];
  const node = new SlackApiCtor({ name: "Slack", method: "chat.postMessage", slack: "cfg-id" });

  const { err } = await invokeNode(node, {
    payload: { channel: "C123", text: "fallback" }
  });

  restoreHttps();

  assert.equal(err, undefined);
  assert.equal(node.errorCalls.length, 0);
});

test("uses default channel when msg.payload.channel is missing", async () => {
  const restoreHttps = mockHttpsRequest((options, callback) => {
    const response = new EventEmitter();
    response.statusCode = 200;

    const request = new EventEmitter();
    request.write = (body) => {
      assert.equal(body, JSON.stringify({ text: "hello", channel: "#default" }));
    };
    request.end = () => {
      callback(response);
      response.emit("data", JSON.stringify({ ok: true }));
      response.emit("end");
    };

    return request;
  });

  const RED = buildRedMock({ getToken: () => "xoxb-token" });
  slackApiModule(RED);

  const SlackApiCtor = RED.registry["slack-api"];
  const node = new SlackApiCtor({
    name: "Slack",
    method: "chat.postMessage",
    channel: "#default",
    slack: "cfg-id"
  });

  const { err } = await invokeNode(node, {
    payload: { text: "hello" }
  });

  restoreHttps();

  assert.equal(err, undefined);
  assert.equal(node.errorCalls.length, 0);
});

test("msg.payload.channel overrides default channel", async () => {
  const restoreHttps = mockHttpsRequest((options, callback) => {
    const response = new EventEmitter();
    response.statusCode = 200;

    const request = new EventEmitter();
    request.write = (body) => {
      assert.equal(body, JSON.stringify({ text: "hello", channel: "#override" }));
    };
    request.end = () => {
      callback(response);
      response.emit("data", JSON.stringify({ ok: true }));
      response.emit("end");
    };

    return request;
  });

  const RED = buildRedMock({ getToken: () => "xoxb-token" });
  slackApiModule(RED);

  const SlackApiCtor = RED.registry["slack-api"];
  const node = new SlackApiCtor({
    name: "Slack",
    method: "chat.postMessage",
    channel: "#default",
    slack: "cfg-id"
  });

  const { err } = await invokeNode(node, {
    payload: { text: "hello", channel: "#override" }
  });

  restoreHttps();

  assert.equal(err, undefined);
  assert.equal(node.errorCalls.length, 0);
});

test("returns error when method is missing", async () => {
  const RED = buildRedMock({ getToken: () => "xoxb-token" });
  slackApiModule(RED);

  const SlackApiCtor = RED.registry["slack-api"];
  const node = new SlackApiCtor({ name: "Slack", method: "", slack: "cfg-id" });

  const { err, sent } = await invokeNode(node, { payload: { channel: "C123", text: "no method" } });

  assert.equal(Boolean(err), true);
  assert.equal(err.message, "Missing Slack method in msg.topic");
  assert.equal(sent, undefined);
  assert.equal(node.errorCalls.length, 1);
});

test("returns error when Slack API responds with ok=false", async () => {
  const restoreHttps = mockHttpsRequest((options, callback) => {
    const response = new EventEmitter();
    response.statusCode = 200;

    const request = new EventEmitter();
    request.write = () => {};
    request.end = () => {
      callback(response);
      response.emit("data", JSON.stringify({ ok: false, error: "channel_not_found" }));
      response.emit("end");
    };

    return request;
  });

  const RED = buildRedMock({ getToken: () => "xoxb-token" });
  slackApiModule(RED);

  const SlackApiCtor = RED.registry["slack-api"];
  const node = new SlackApiCtor({ name: "Slack", method: "", slack: "cfg-id" });

  const { err } = await invokeNode(node, {
    topic: "chat.postMessage",
    payload: { channel: "C123", text: "hello" }
  });

  restoreHttps();

  assert.equal(Boolean(err), true);
  assert.equal(err.message, "Slack API error: channel_not_found");
  assert.equal(node.errorCalls.length, 1);
});

test("returns error when Slack HTTP status is >= 400", async () => {
  const restoreHttps = mockHttpsRequest((options, callback) => {
    const response = new EventEmitter();
    response.statusCode = 429;

    const request = new EventEmitter();
    request.write = () => {};
    request.end = () => {
      callback(response);
      response.emit("data", JSON.stringify({ ok: false, error: "rate_limited" }));
      response.emit("end");
    };

    return request;
  });

  const RED = buildRedMock({ getToken: () => "xoxb-token" });
  slackApiModule(RED);

  const SlackApiCtor = RED.registry["slack-api"];
  const node = new SlackApiCtor({ name: "Slack", method: "", slack: "cfg-id" });

  const { err } = await invokeNode(node, {
    topic: "chat.postMessage",
    payload: { channel: "C123", text: "hello" }
  });

  restoreHttps();

  assert.equal(Boolean(err), true);
  assert.equal(err.message, "Slack HTTP error 429");
  assert.equal(err.statusCode, 429);
  assert.equal(node.errorCalls.length, 1);
});
