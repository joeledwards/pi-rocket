const fs = require('fs');
const cogs = require('cogs-sdk');
const express = require('express');

const bindPort = 8080;
const app = express();

cogs.client.getClient('../cogswell.json')
.then(client => {
  console.log('Cogswell client allocated.');

  // Publish a message to the control bus
  function publish(channel, command) {
    return client.sendEvent('pi-rocket', 'control', {'channel': channel, 'command': command})
    .then(({event_id: eventId}) => {
      console.log(`Published event '${eventId}' to Cogs.`)
    })
    .catch(error => {
      console.error(`Error sending event to Cogs:`, error)
    });
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
});

