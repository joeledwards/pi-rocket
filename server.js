require('log-a-log');

const _ = require('lodash');
const P = require('bluebird');
const fs = require('fs');
const cogs = require('cogs-sdk');
const express = require('express');
const durations = require('durations');

const pi = require('./pi');

const bindPort = 8080;

const countDownWatch = durations.stopwatch();
const burnWatch = durations.stopwatch();

let countingDown = false;
let burning = false;

let countDownDuration = 10000;
let burnDuration = 5000;
let noPi = true;

function pinOn(pin) {
  return noPi ? P.resolve() : pi.on(pin);
}

function pinOff(pin) {
  return noPi ? P.resolve() : pi.off(pin);
}

// Sleep (non-blocking) for the specified duration.
function sleep(duration) {
  return new P(resolve => setTimeout(() => resolve(), duration));
}

function countDownRemaining() {
  return durations.duration(
    countDownDuration * 1000000 - countDownWatch.duration().nanos()
  );
}

function burnRemaining() {
  return durations.duration(
    burnDuration * 1000000 - burnWatch.duration().nanos()
  );
}

function relayOn() {
  return new P((resolve, reject) => {
    if (burning) {
      console.log('Ignition already active.');
      resolve({
        code: 200,
        response: {status: 'ignition-active'},
      });
    } else {
      console.log('Activating ignition.');
      burning = true;
      burnWatch.reset().start();

      pinOn(32)
      .then(() => {
        console.log('Ignition active.');
        resolve({
          code: 200,
          response: {status: 'ignition-active'},
        });
      })
      .catch((error) => {
        logger.error('Error:', error)
        resolve({
          code: 500,
          response: {status: 'error'},
        });
      });
    }
  });
}

function relayOff() {
  return new P((resolve, reject) => {
    if (burning) {
      console.log('Deactivating ignition.');
      burning = false;
      burnWatch.reset();

      pinOff(32)
      .then(() => {
        console.log('Ignition deactivated.');
        resolve({
          code: 200,
          response: {status: 'inactive'},
        });
      })
      .catch((error) => {
        logger.error('Error:', error)
        resolve({
          code: 500,
          response: {status: 'error'},
        });
      });
    } else {
      console.log('Ignition already inactive');
      resolve({
        code: 200,
        response: {status: 'inactive'},
      });
    }
  });
}

function relayStatus() {
  return new P((resolve, reject) => {
    if (burning) {
      console.log(`Ignition is active, remaining duration is ${countDownRemaining()}.`);

      resolve({
        code: 200,
        response: {
          status: 'ignition-active',
          remaining: burnRemaining().millis(),
        },
      });
    } else if (countingDown) {
      console.log(`Countdown is active, remaining duration is ${burnRemaining()}.`);

      resolve({
        code: 200,
        response: {
          status: 'counting-down',
          remaining: countDownRemaining().millis(),
        },
      });
    } else {
      console.log(`System inactive.`);

      resolve({
        code: 200,
        response: {status: 'inactive'},
      });
    }
  });
}

function relayCountDown() {
  return new P((resolve, reject) => {
    if (burning) {
      console.log(`Ignition active, ${burnRemaining()} remaining.`);

      resolve({
        code: 200,
        response: {
          status: 'ignition-active',
          remaining: burnRemaining().millis(),
        },
      });
    } else {
      if (countingDown) {
        console.log(`Countdown is already running, ${countDownRemaining()} remaining.`);
      } else {
        countingDown = true;
        countDownWatch.reset().start();
        console.log(`Starting countdown, ${countDownRemaining()} remaining.`);

        sleep(countDownDuration)
        .then(() => {
          if (countingDown) {
            countingDown = false;
            burning = true;
            countDownWatch.reset();
            burnWatch.reset().start();
            console.log(`Ignition on, ${countDownRemaining()} remaining.`);

            return pinOn(32)
            .then(() => sleep(5000))
            .then(() => {
              burning = false;
              burnWatch.reset();
              console.log(`Ignition off.`);
              pinOff(32)
            });
          } else {
            console.log('Ignition cancelled.');
          }
        })
        .catch((error) => console.error('Error during launch:', error));
      }

      resolve({
        code: 200,
        response: {
          status: 'counting-down',
          remaining: countDownRemaining().millis(),
        },
      });
    }
  });
}

function relayCancelCountDown() {
  return new P((resolve, reject) => {
    if (burning) {
      console.log(`Burn active, ${burnRemaining()} remaining.`);

      resolve({
        code: 200,
        response: {
          status: 'ignition-active',
          remaining: burnRemaining().millis(),
        },
      });
    } else if (countingDown) {
      countingDown = false;
      console.log(`Countdown cancelled with ${countDownRemaining()} remaining.`);
      countDownWatch.reset();

      resolve({
        code: 200,
        response: {status: 'countdown-cancelled'},
      });
    } else {
      console.log('System inactive.');

      resolve({
        code: 200,
        response: {status: 'inactive'},
      });
    }
  });
}

const app = express();

cogs.client.getClient('./cogswell.json')
.then(client => {
  // Publish a message to the control bus
  function publish(channel, message) {
    return cogsClient.sendEvent('directive', 'pi-rocket', {'channel': channel, 'command': command})
    .then(({event_id: eventId}) => console.log(`Published event '${eventId}' to Cogs.`))
    .catch(error => console.error(`Error sending event to Cogs:`, error));
  }

  const ws = client.subscribe('pi-rocket', {'channel': 'pi-rocket-control'});

  ws.on('connectFailed', (error) => console.error("Error subscribing to channel:", error));
  ws.on('error', error => console.error('Error on control channel:', error));
  ws.on('open', () => console.log('Connected to control channel.'));
  ws.on('reconnect', () => console.log('Reconnected to control channel.'));
  ws.on('close', () => console.error('Control channel closed.'));
  ws.on('ack', messageId => console.error(`Message ${messageId} acknowledged.`));

  ws.on('message', message => {
    let {data: {command}, message_id: messageId} = JSON.parse(message);

    // Control via Cogswell
    switch (command) {
      case 'relay-on': 
        relayOn().then(
          r => publish('pi-rocket-notifications', JSON.stringify(r))
        );
        
        break;
      case 'relay-off': 
        relayOff().then(
          r => publish('pi-rocket-notifications', JSON.stringify(r))
        );

        break;
      case 'status':
        relayStatus().then(
          r => publish('pi-rocket-notifications', JSON.stringify(r))
        );

        break;
      case 'count-down':
        relayCountDown().then(
          r => publish('pi-rocket-notifications', JSON.stringify(r))
        );

        break;
      case 'cancel-count-down':
        relayCancelCountDown().then(
          r => publish('pi-rocket-notifications', JSON.stringify(r))
        );

        break;
      default:
        console.error(`Unrecognized command '${command}'`);

        break;
    }
  });

  // Serve up the control website
  app.use('/control', express.static('public'));

  // Switch relay on
  app.post('/on', (req, res) => {
    relayOn().then(r => res.status(r.code).json(r.response));
  });

  // Switch relay off
  app.post('/off', (req, res) => {
    relayOff().then(r => res.status(r.code).json(r.response));
  });

  // Poll count down duration
  app.get('/status', (req, res) => {
    relayStatus().then(r => res.status(r.code).json(r.response));
  });

  // Countdown to launch
  app.post('/count-down', (req, res) => {
    relayCountDown().then(r => res.status(r.code).json(r.response));
  });

  // Cancel countdown
  app.post('/cancel-count-down', (req, res) => {
    relayCancelCountDown().then(r => res.status(r.code).json(r.response));
  });

  app.listen(bindPort, console.log(`Listening on port ${bindPort}`));
});

