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

// Control echo
nub.subscribe({
  channel: 'pi-rocket-control',
  message: json => console.log('Control message:', json),
});

// Notifications from PubNub
nub.subscribe({
  channel: 'pi-rocket-notifications',
  message: json => {
    console.log('Notification:', json);

    let {command} =  JSON.parse(json);
    if (command === 'relay-on') { 
      relayOn()
      .then(r => publish('pi-rocket-notifications', JSON.stringify(r)));
    } else if (command === 'relay-off') {
      relayOff()
      .then(r => publish('pi-rocket-notifications', JSON.stringify(r)));
    } else {
      console.error(`Unrecognized command '${command}'`);
    }
  },
});

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
