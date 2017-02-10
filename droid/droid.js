const fs = require('fs');
const cogs = require('cogs-sdk');
const express = require('express');

const bindPort = 8080;

const config;
function getConfig() {
  if (!config) {
    config = new P((resolve, reject) => {
      fs.readFile('../cogs-pubsub.json', (error, raw) => {
        if (error) {
          reject(error);
        } else {
          resolve(JSON.parse(raw));
        }
      })
    });
  }

  return config;
}

function runServer(handle) {
  console.log('Pub/Sub connection established.');

  // Publish a message to the control bus
  function publish(channel, command) {
    return handle.publishWithAck(channel, command)
    .catch(error => {
      console.error(`Error sending command '${command}' to channel '${chanel}'`);
      throw error;
    });
  }

  handle.on('error', error => console.error('Error with control socket:', error));
  handle.on('reconnect', () => console.log('Reconnected to control bus channel.'));

  // Log all notifications from the ignition system.
  handle.subscribe('pi-rocket-notifications', message => {
    console.log(`Received a notification message: ${message}`);
  })
  .then(() => console.log("Subscribed to the notification channel."))
  .catch(error => console.error("Error subscribing to the notification channel", error));

  // Echo all control commands back to the controller.
  client.subscribe('pi-rocket-control', message => {
    console.log(`Received a control message: ${message}`);
  })
  .then(() => console.log("Subscribed to the control channel."))
  .catch(error => console.error("Error subscribing to the control channel", error));

  const app = express();

  // Serve up the control website
  app.use('/control', express.static('../public'));

  // Switch relay on
  app.post('/on', (req, res) => {
    publish('pi-rocket-control', 'relay-on')
    .then(() => res.status(200).json({code: 200}))
    .catch(error => res.status(500).json({code: 500}));
  });

  // Switch relay off
  app.post('/off', (req, res) => {
    publish('pi-rocket-control', 'relay-off')
    .then(() => res.status(200).json({code: 200}))
    .catch(error => res.status(500).json({code: 500}));
  });

  // Check relay status
  app.post('/status', (req, res) => {
    publish('pi-rocket-control', 'status')
    .then(() => res.status(200).json({code: 200}))
    .catch(error => res.status(500).json({code: 500}));
  });

  // Initiate count-down
  app.post('/count-down', (req, res) => {
    publish('pi-rocket-control', 'count-down')
    .then(() => res.status(200).json({code: 200}))
    .catch(error => res.status(500).json({code: 500}));
  });

  // Cancel count-down
  app.post('/cancel-count-down', (req, res) => {
    publish('pi-rocket-control', 'cancel-count-down')
    .then(() => res.status(200).json({code: 200}))
    .catch(error => res.status(500).json({code: 500}));
  });

  app.listen(bindPort, console.log(`Listening on port ${bindPort}`));
}

function main() {
  getConfig()
  .then(({keys, options}) => cogs.pubsub.connect(keys, options))
  .then(handle => runServer(handle))
  .catch(error => console.error("Error with launch control server:", error));
}

main();
