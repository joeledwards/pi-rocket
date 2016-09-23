const fs = require('fs');
const cogs = require('cogs-sdk');
const express = require('express');

const bindPort = 8080;
const app = express();

cogs.getClient('../cogswell.json')
.then(client => {
  // Publish a message to the control bus
  function publish(channel, message) {
    client.sendEvent('control', 'pi-rocket', {'channel': channel, 'command': message})
    .then(({event_id: eventId}) => console.log(`Published event '${eventId}' to Cogs.`))
    .catch(error => console.error(`Error sending event to Cogs:`, error));
  }

  const notifyWs = client.subscribe('pi-rocket', {channel: 'pi-rocket-notifications'});
  notifyWs.on('connectFailed', (error) => console.error("Error connecting to notify channel:", error));
  notifyWs.on('error', error => console.error('Error on notification channel:', error));
  notifyWs.on('open', () => console.log('Connected to notification channel.'));
  notifyWs.on('reconnect', () => console.log('Reconnected to notification channel.'));
  notifyWs.on('close', () => console.error('Notification channel closed.'));
  notifyWs.on('ack', messageId => console.error(`Message ${messageId} acknowledged.`));
  notifyWs.on('message', message => {
    let {data: {command}, message_id: messageId} = JSON.parse(message);

    console.log(`Received a notification message: ${message}`);
  });

  const echoWs = client.subscribe('pi-rocket', {channel: 'pi-rocket-control'})
  echoWs.on('message', message => console.log(`Received a control message: ${message}`));
  echoWs.on('error', error => console.error('Error on control channel:', error));
  echoWs.on('connectFailed', error => console.error('Error connecting to control channel:', error));
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

// Check relay status
app.post('/status', (req, res) => {
  publish('pi-rocket-control', JSON.stringify({command: 'status'}));
});

// Initiate count-down
app.post('/count-down', (req, res) => {
  publish('pi-rocket-control', JSON.stringify({command: 'count-down'}));
});

// Cancel count-down
app.post('/cancel-count-down', (req, res) => {
  publish('pi-rocket-control', JSON.stringify({command: 'cancel-count-down'}));
});

app.listen(bindPort, console.log(`Listening on port ${bindPort}`));
