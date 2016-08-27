const fs = require('fs');
const pubnub = require('pubnub');
const express = require('express');

const bindPort = 8080;
const app = express();

let {pubKey, subKey, secret} = JSON.parse(fs.readFileSync('../pubnub.json'));
const pubnubConfig = {
  ssl: true,
  publish_key: pubKey,
  subscribe_key: subKey,
};
const nub = pubnub(pubnubConfig);

// Publish a message to the control bus
function publish(channel, message) {
  nub.publish({
    channel: channel,
    message: message,
    callback: result => console.log('Message published:', result),
    error: error => console.error('Error publishing message:', error),
  });
}

// Serve up the control website
app.use('/control', express.static('../public'));

// Switch relay on
app.post('/on', (req, res) => {
  publish('pi-rocket-control', JSON.stringify({command: 'relay-on'}));
});

// Switch relay off
app.post('/off', (req, res) => {
  publish('pi-rocket-control', JSON.stringify({command: 'relay-off'}));
});

app.listen(bindPort, console.log(`Listening on port ${bindPort}`));
