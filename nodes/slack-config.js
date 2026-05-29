module.exports = function (RED) {
  function SlackConfigNode(config) {
    RED.nodes.createNode(this, config);

    this.name = config.name;

    this.getToken = () => {
      const token = this.credentials && typeof this.credentials.token === "string"
        ? this.credentials.token.trim()
        : "";
      return token;
    };
  }

  RED.nodes.registerType("slack-config", SlackConfigNode, {
    credentials: {
      token: { type: "password" }
    }
  });
};
