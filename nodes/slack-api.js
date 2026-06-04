const https = require("https");

module.exports = function (RED) {
  function SlackApiNode(config) {
    RED.nodes.createNode(this, config);

    const node = this;
    node.name = config.name;
    node.defaultMethod = (config.method || "chat.postMessage").trim();
    node.defaultChannel = (config.channel || "").trim();
    node.slackConfig = RED.nodes.getNode(config.slack);

    node.on("input", function (msg, send, done) {
      send = send || function () {
        node.send.apply(node, arguments);
      };

      done = done || function (err) {
        if (err) {
          node.error(err, msg);
        }
      };

      const method = ((msg.topic || node.defaultMethod) + "").trim();
      const params = msg.payload;

      if (!node.slackConfig) {
        const err = new Error("Missing Slack config node");
        node.status({ fill: "red", shape: "ring", text: "missing config" });
        node.error(err, msg);
        done(err);
        return;
      }

      const token = node.slackConfig.getToken();
      if (!token) {
        const err = new Error("Missing Slack token in selected config");
        node.status({ fill: "red", shape: "ring", text: "missing token" });
        node.error(err, msg);
        done(err);
        return;
      }

      if (!method) {
        const err = new Error("Missing Slack method in msg.topic");
        node.status({ fill: "red", shape: "ring", text: "missing method" });
        node.error(err, msg);
        done(err);
        return;
      }

      if (typeof params !== "object" || params === null || Array.isArray(params)) {
        const err = new Error("msg.payload must be an object for Slack Web API parameters");
        node.status({ fill: "red", shape: "ring", text: "invalid payload" });
        node.error(err, msg);
        done(err);
        return;
      }

      const requestPayload = { ...params };
      const hasInputChannel = Object.prototype.hasOwnProperty.call(requestPayload, "channel")
        && ((requestPayload.channel || "") + "").trim() !== "";
      if (!hasInputChannel && node.defaultChannel) {
        requestPayload.channel = node.defaultChannel;
      }

      const body = JSON.stringify(requestPayload);
      const requestOptions = {
        hostname: "slack.com",
        path: "/api/" + method,
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": Buffer.byteLength(body)
        }
      };

      node.status({ fill: "blue", shape: "dot", text: "calling " + method });

      const request = https.request(requestOptions, (response) => {
        let responseBody = "";

        response.on("data", (chunk) => {
          responseBody += chunk;
        });

        response.on("end", () => {
          let parsed = responseBody;

          try {
            parsed = JSON.parse(responseBody);
          } catch (err) {
            parsed = responseBody;
          }

          const statusCode = response.statusCode || 0;
          const slackOk = typeof parsed === "object" && parsed !== null
            ? parsed.ok
            : undefined;

          if (statusCode >= 400) {
            const err = new Error("Slack HTTP error " + statusCode);
            err.statusCode = statusCode;
            err.method = method;
            err.response = parsed;
            node.status({ fill: "red", shape: "ring", text: "http " + statusCode });
            node.error(err, msg);
            done(err);
            return;
          }

          if (slackOk === false) {
            const code = parsed && parsed.error ? parsed.error : "slack_api_error";
            const err = new Error("Slack API error: " + code);
            err.code = code;
            err.method = method;
            err.response = parsed;
            node.status({ fill: "red", shape: "ring", text: code });
            node.error(err, msg);
            done(err);
            return;
          }

          msg.payload = parsed;
          msg.slack = {
            method,
            statusCode,
            ok: slackOk
          };

          node.status({ fill: "green", shape: "dot", text: "ok " + method });
          send(msg);
          done();
        });
      });

      request.on("error", (err) => {
        node.status({ fill: "red", shape: "ring", text: "request failed" });
        node.error(err, msg);
        done(err);
      });

      request.write(body);
      request.end();
    });
  }

  RED.nodes.registerType("slack-api", SlackApiNode);
};
