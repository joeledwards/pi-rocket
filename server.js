//require('log-a-log');

const _ = require('lodash');
const Q = require('q');
const P = require('bluebird');
const pubnub = require('pubnub');
const express = require('express');
const durations = require('durations');

const pi = require('./pi');

const bindPort = 8080;

const runWatch = durations.stopwatch();
const burnWatch = durations.stopwatch();

let running = false;
let burning = false;

let runDuration = 10000;
let burnDuration = 5000;

function runRemaining() {
  return durations.duration(
    runDuration * 1000000 - runWatch.duration().nanos()
  );
}

function burnRemaining() {
  return durations.duration(
    burnDuration * 1000000 - burnWatch.duration().nanos()
  );
}

const app = express();

const pubnubConfig = fs.readFileSync('./pubnub.json');
const nub = pubnub(pubnubConfig);

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

      pi.on(32)
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

      pi.off(32)
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
}

function relayCountDown() {
}

function relayCancelCountDown() {
}

// Publish a message to the control bus
function publish(channel, message) {
  nub.publish({
    channel: channel,
    message: message,
    callback: result => console.log('Message published:', result),
    error: error => console.error('Error publishing message:', error),
  });
}

// Control via PubNub
nub.subscribe({
  channel: 'pi-rocket-control',
  message: json => {
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
app.use('/control', express.static('public'));

// Switch relay on
app.post('/on', (req, res) => {
  relayOn().then(r => res.status(r.code).json(r.response));
});

// Switch relay off
app.post('/off', (req, res) => {
  relayOff().then(r => res.status(r.code).json(r.response));
});

// Countdown to launch
app.post('/count-down', (req, res) => {
  if (burning) {
    console.log(`Ignition active, ${burnRemaining()} remaining.`);

    res.status(200).json({
      status: 'ignition-active',
      remaining: burnRemaining(),
    });
  } else {
    if (running) {
      console.log(`Countdown is already running, ${runRemaining()} remaining.`);
    } else {
      running = true;
      runWatch.reset().start();
      console.log(`Starting countdown, ${runRemaining()} remaining.`);

      pi.sleep(runDuration)
      .then(() => {
        if (running) {
          running = false;
          burning = true;
          runWatch.reset();
          burnWatch.reset().start();
          console.log(`Ignition on, ${runRemaining()} remaining.`);

          return pi.on(32)
          .then(() => pi.sleep(5000))
          .then(() => {
            burning = false;
            burnWatch.reset();
            console.log(`Ignition off.`);
            pi.off(32)
          });
        } else {
          console.log('Ignition cancelled.');
        }
      })
      .catch((error) => console.error('Error during launch:', error));
    }

    res.status(200).json({
      status: 'counting-down',
      remaining: runRemaining().millis(),
    });
  }
});

// Poll count down duration
app.get('/status', (req, res) => {
  if (burning) {
    console.log(`Ignition is active, remaining duration is ${runRemaining()}.`);
    res.status(200).json({
      status: 'ignition-active',
      remaining: burnRemaining().millis(),
    });
  } else if (running) {
    console.log(`Countdown is active, remaining duration is ${burnRemaining()}.`);
    res.status(200).json({
      status: 'counting-down',
      remaining: runRemaining().millis(),
    });
  } else {
    console.log(`System inactive.`);
    res.status(200).json({status: 'inactive'});
  }
});

// Cancel countdown
app.post('/cancel-count-down', (req, res) => {
  if (burning) {
    console.log(`Burn active, ${burnRemaining()} remaining.`);
    res.status(200).json({
      status: 'ignition-active',
      remaining: burnRemaining().millis(),
    });
  } else if (running) {
    running = false;
    console.log(`Countdown cancelled with ${runRemaining()} remaining.`);
    runWatch.reset();
    res.status(200).json({status: 'countdown-cancelled'});
  } else {
    console.log('System inactive.');
    res.status(200).json({status: 'inactive'});
  }
});

app.listen(bindPort, console.log(`Listening on port ${bindPort}`));

