require('log-a-log')();

const fs = require('fs');
const PubNub = require('pubnub');
const express = require('express');

const bindPort = coalesce(process.env.PI_ROCKET_BIND_PORT, 8080);
const bindHost = coalesce(process.env.PI_ROCKET_BIND_HOST, '0.0.0.0');
const configPath = coalesce(process.env.PI_ROCKET_CONFIG, '../pubnub.json')

let config;
function getConfig() {
  if (!config) {
    config = new Promise((resolve, reject) => {
      fs.readFile(configPath, (error, raw) => {
        try {
          if (error) {
            reject(error);
          } else {
            resolve(JSON.parse(raw));
          }
        } catch (err) {
          reject(err)
        }
      })
    });
  }

  return config;
}

function coalesce() {
  return Object.values(arguments).filter(v => v !== null && v !== undefined)[0]
}

function runServer({pubKey, subKey}) {
  const pubnub = new PubNub({
    publish_key: pubKey,
    subscribe_key: subKey
  })

  // Publish a message to the control bus
  function publish(channel, command) {
    return new Promise(resolve => {
      pubnub.publish({
        channel,
        message: command,
      }, (status, response) => resolve())
    })
  }

  pubnub.addListener({
    status: event => console.log('PubNub status event:', event),
    presence: event => console.log('PubNub presence event:', eent),
    message: messageHandler,
  })

  function messageHandler(msg) {
    const {channel, message} = msg

    switch (channel) {
      case 'pi-rocket-control':
        // Log all notifications from the ignition system.
        console.log(`Received a control message: ${message}`);
        break;
      case 'pi-rocket-notifications':
        // Echo all control commands back to the controller.
        console.log(`Received a notification message: ${message}`);
        break;
    }
  }

  pubnub.subscribe({
    channels: ['pi-rocket-control', 'pi-rocket-notifications']
  })

  const app = express();

  // Serve up the control website
  app.use('/control', express.static('public'));

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

  app.listen(bindPort, bindHost, () => {
    console.log(`Listening on ${bindHost}:${bindPort} ...`)
  });
}

function main() {
  getConfig()
  .then(handle => runServer(handle))
  .catch(error => {
    console.error("Error with launch control server:", error)
    process.exit(1)
  });
}

main();
