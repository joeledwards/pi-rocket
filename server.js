require('log-a-log')();

const _ = require('lodash');
const fs = require('fs');
const PubNub = require('pubnub');
const express = require('express');
const durations = require('durations');

const configPath = coalesce(process.env.PI_ROCKET_CONFIG, 'pubnub.json');
const bindHost = coalesce(process.env.PI_ROCKET_BIND_HOST, '0.0.0.0');
const bindPort = coalesce(process.env.PI_ROCKET_BIND_PORT, 8080);
const noPi = coalesce(process.env.PI_ROCKET_NO_PI, false);

let countDownDuration = 10000;
let burnDuration = 5000;

const pi = noPi ? {} : require('./pi')

let countingDown = false;
let burning = false;

const countDownWatch = durations.stopwatch();
const burnWatch = durations.stopwatch();

function coalesce() {
  return Object.values(arguments).filter(x => x !== null && x !== undefined)[0]
}

function pinOn(pin) {
  return noPi ? Promise.resolve() : pi.on(pin);
}

function pinOff(pin) {
  return noPi ? Promise.resolve() : pi.off(pin);
}

// Sleep (non-blocking) for the specified duration.
function sleep(duration) {
  return new Promise(resolve => setTimeout(resolve, duration));
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
  return new Promise((resolve, reject) => {
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
        console.error('Error:', error)
        resolve({
          code: 500,
          response: {status: 'error'},
        });
      });
    }
  });
}

function relayOff() {
  return new Promise((resolve, reject) => {
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
        console.error('Error:', error)
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
  return new Promise((resolve, reject) => {
    if (burning) {
      console.log(`Ignition is active, remaining duration is ${burnRemaining()}.`);

      resolve({
        code: 200,
        response: {
          status: 'ignition-active',
          remaining: burnRemaining().millis(),
        },
      });
    } else if (countingDown) {
      console.log(`Countdown is active, remaining duration is ${countDownRemaining()}.`);

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
  return new Promise((resolve, reject) => {
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
            console.log(`Ignition on, ${burnRemaining()} remaining.`);

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
  return new Promise((resolve, reject) => {
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

function runServer({pubKey, subKey}) {
  const pubnub = new PubNub({
    publish_key: pubKey,
    subscribe_key: subKey
  })

  // Publish a message to the control bus
  function publish(channel, notification) {
    return new Promise(resolve => {
      pubnub.publish({
        channel,
        message: notification,
      }, (status, response) => resolve())
    })
  }

  pubnub.addListener({
    status: event => {
      if (event.error)
        console.error('PubNub status error:', event)
      else
        console.log('PubNub status event:', event)
    },
    presence: event => {
      if (event.error)
        console.log('PubNub presence error:', eent)
      else
        console.log('PubNub presence event:', eent)
    },
    message: commandHandler,
  })

  pubnub.subscribe({
    channels: ['pi-rocket-control']
  })

  // Echo all control commands back to the controller.
  function commandHandler (msg) {
    const {message: command} = msg;
    console.log(`Received a command message: ${command}`);

    // Control via PubNub
    switch (command) {
      case 'relay-pulse':
        relayOn().then(
          r => publish('pi-rocket-notifications', JSON.stringify(r))
        ).then(
          () => new Promise(cb => setTimeout(cb, 1000))
        ).then(
          () => relayOff()
        ).then(
          r => publish('pi-rocket-notifications', JSON.stringify(r))
        );
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
  }

  if (!noPi) {
    pi.listen((channel, value) => {
      console.log(`${channel} is now ${value}`);
    });
  }

  const app = express();

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

  app.get('/routes', (req, res) => {
    res.status(200).json(
      app._router.stack
      .filter(r => r.route)
      .map(
        ({
          route: {
            path,
            stack: [{method}] = []
          } = {}
        }) => ({method, path})
      )
    )
  })

  app.listen(bindPort, bindHost, () => {
    console.log(`Listening on ${bindHost}:${bindPort} ...`);
  })
}

function main() {
  console.log(`  config-path : ${configPath}`)
  console.log(`    bind-host : ${bindHost}`)
  console.log(`    bind-port : ${bindPort}`)
  console.log(`        no-pi : ${noPi}`)
  console.log('Starting launch server...')

  getConfig()
  .then(runServer)
  .catch(error => {
    console.error("Error in ignition system:", error)
    process.exit(1)
  });
}

process
.on('unhandledRejection', (reason, p) => {
  console.error(reason, 'Unhandled Rejection at Promise', p);
})
.on('uncaughtException', err => {
  console.error(err, 'Uncaught Exception thrown');
  process.exit(1);
})
.on('exit', () => console.log(`Exit ${process.pid}`));

main();
