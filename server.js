require('log-a-log')()

const fs = require('fs')
const PubNub = require('pubnub')
const express = require('express')
const durations = require('durations')

const configPath = coalesce(process.env.PI_ROCKET_CONFIG, 'pubnub.json')
const bindHost = coalesce(process.env.PI_ROCKET_BIND_HOST, '0.0.0.0')
const bindPort = coalesce(process.env.PI_ROCKET_BIND_PORT, 8080)
const noPi = coalesce(process.env.PI_ROCKET_NO_PI, false)

let countDownDuration = 10000
let burnDuration = 5000

const pi = noPi ? {} : require('./pi')

let countingDown = false
let burning = false

const countDownWatch = durations.stopwatch()
const burnWatch = durations.stopwatch()

function coalesce () {
  return Object.values(arguments).filter(x => x !== null && x !== undefined)[0]
}

async function pinOn (pin) {
  return noPi ? Promise.resolve() : pi.on(pin)
}

async function pinOff (pin) {
  return noPi ? Promise.resolve() : pi.off(pin)
}

// Sleep (non-blocking) for the specified duration.
async function sleep (duration) {
  return new Promise(resolve => setTimeout(resolve, duration))
}

function countDownRemaining () {
  return durations.duration(
    countDownDuration * 1000000 - countDownWatch.duration().nanos()
  )
}

function burnRemaining () {
  return durations.duration(
    burnDuration * 1000000 - burnWatch.duration().nanos()
  )
}

async function relayOn () {
  return new Promise(async resolve => {
    if (burning) {
      console.log('Ignition already active.')
      resolve({
        code: 200,
        response: { status: 'ignition-active' }
      })
    } else {
      console.log('Activating ignition.')
      burning = true
      burnWatch.reset().start()

      try {
        await pinOn(32)
        console.log('Ignition active.')
        resolve({
          code: 200,
          response: { status: 'ignition-active' }
        })
      } catch (error) {
        console.error('Error:', error)
        resolve({
          code: 500,
          response: { status: 'error' }
        })
      }
    }
  })
}

async function relayOff () {
  return new Promise(async resolve => {
    if (burning) {
      console.log('Deactivating ignition.')
      burning = false
      burnWatch.reset()

      try {
        await pinOff(32)
        console.log('Ignition deactivated.')
        resolve({
          code: 200,
          response: { status: 'inactive' }
        })
      } catch (error) {
        console.error('Error:', error)
        resolve({
          code: 500,
          response: { status: 'error' }
        })
      }
    } else {
      console.log('Ignition already inactive')
      resolve({
        code: 200,
        response: { status: 'inactive' }
      })
    }
  })
}

async function relayStatus () {
  return new Promise(resolve => {
    if (burning) {
      console.log(`Ignition is active, remaining duration is ${burnRemaining()}.`)

      resolve({
        code: 200,
        response: {
          status: 'ignition-active',
          remaining: burnRemaining().millis()
        }
      })
    } else if (countingDown) {
      console.log(`Countdown is active, remaining duration is ${countDownRemaining()}.`)

      resolve({
        code: 200,
        response: {
          status: 'counting-down',
          remaining: countDownRemaining().millis()
        }
      })
    } else {
      console.log(`System inactive.`)

      resolve({
        code: 200,
        response: { status: 'inactive' }
      })
    }
  })
}

async function relayCountDown () {
  return new Promise(async resolve => {
    if (burning) {
      console.log(`Ignition active, ${burnRemaining()} remaining.`)

      resolve({
        code: 200,
        response: {
          status: 'ignition-active',
          remaining: burnRemaining().millis()
        }
      })
    } else {
      if (countingDown) {
        console.log(`Countdown is already running, ${countDownRemaining()} remaining.`)
      } else {
        countingDown = true
        countDownWatch.reset().start()
        console.log(`Starting countdown, ${countDownRemaining()} remaining.`)

        try {
          await sleep(countDownDuration)

          if (countingDown) {
            countingDown = false
            burning = true
            countDownWatch.reset()
            burnWatch.reset().start()

            await pinOn(32)
            console.log(`Ignition on, ${burnRemaining()} remaining.`)

            await sleep(burnRemaining().millis())

            await pinOff(32)
            console.log(`Ignition off.`)

            burning = false
            burnWatch.reset()
          } else {
            console.log('Ignition cancelled.')
          }
        } catch (error) {
          console.error('Error during launch:', error)
        }
      }

      resolve({
        code: 200,
        response: {
          status: 'counting-down',
          remaining: countDownRemaining().millis()
        }
      })
    }
  })
}

async function relayCancelCountDown () {
  return new Promise(resolve => {
    if (burning) {
      console.log(`Burn active, ${burnRemaining()} remaining.`)

      resolve({
        code: 200,
        response: {
          status: 'ignition-active',
          remaining: burnRemaining().millis()
        }
      })
    } else if (countingDown) {
      countingDown = false
      console.log(`Countdown cancelled with ${countDownRemaining()} remaining.`)
      countDownWatch.reset()

      resolve({
        code: 200,
        response: { status: 'countdown-cancelled' }
      })
    } else {
      console.log('System inactive.')

      resolve({
        code: 200,
        response: { status: 'inactive' }
      })
    }
  })
}

let config
async function getConfig () {
  if (!config) {
    config = new Promise((resolve, reject) => {
      fs.readFile(configPath, (error, raw) => {
        try {
          error ? reject(error) : resolve(JSON.parse(raw))
        } catch (err) {
          reject(err)
        }
      })
    })
  }

  return config
}

function runServer ({ pubKey, subKey }) {
  const pubnub = new PubNub({
    publish_key: pubKey,
    subscribe_key: subKey
  })

  // Publish a message to the control bus
  function publish (channel, notification) {
    return new Promise(resolve => {
      pubnub.publish({
        channel,
        message: notification
      }, (status, response) => resolve())
    })
  }

  pubnub.addListener({
    status: event => {
      if (event.error) { console.error('PubNub status error:', event) } else { console.log('PubNub status event:', event) }
    },
    presence: event => {
      if (event.error) { console.log('PubNub presence error:', event) } else { console.log('PubNub presence event:', event) }
    },
    message: commandHandler
  })

  pubnub.subscribe({
    channels: ['pi-rocket-control']
  })

  // Echo all control commands back to the controller.
  async function commandHandler (msg) {
    const { message: command } = msg
    console.log(`Received a command message: ${command}`)

    // Control via PubNub
    switch (command) {
      case 'relay-pulse':
        const rpOn = await relayOn()
        await publish('pi-rocket-notifications', JSON.stringify(rpOn))
        await sleep(1000)
        const rpOff = await relayOff()
        await publish('pi-rocket-notifications', JSON.stringify(rpOff))

        break
      case 'relay-on':
        const rOn = await relayOn()
        await publish('pi-rocket-notifications', JSON.stringify(rOn))

        break
      case 'relay-off':
        const rOff = await relayOff()
        await publish('pi-rocket-notifications', JSON.stringify(rOff))

        break
      case 'status':
        const status = await relayStatus()
        await publish('pi-rocket-notifications', JSON.stringify(status))

        break
      case 'count-down':
        const cd = await relayCountDown()
        await publish('pi-rocket-notifications', JSON.stringify(cd))

        break
      case 'cancel-count-down':
        const ccd = await relayCancelCountDown()
        await publish('pi-rocket-notifications', JSON.stringify(ccd))

        break
      default:
        console.error(`Unrecognized command '${command}'`)

        break
    }
  }

  if (!noPi) {
    // Report on changes to the value of the identified channel
    pi.listen((channel, value) => {
      console.log(`${channel} is now ${value}`)
    })
  }

  const app = express()

  // Serve up the control website
  app.use('/control', express.static('public'))

  // Switch relay on
  app.post('/on', (req, res) => {
    relayOn().then(r => res.status(r.code).json(r.response))
  })

  // Switch relay off
  app.post('/off', (req, res) => {
    relayOff().then(r => res.status(r.code).json(r.response))
  })

  // Poll count down duration
  app.get('/status', (req, res) => {
    relayStatus().then(r => res.status(r.code).json(r.response))
  })

  // Countdown to launch
  app.post('/count-down', (req, res) => {
    relayCountDown().then(r => res.status(r.code).json(r.response))
  })

  // Cancel countdown
  app.post('/cancel-count-down', (req, res) => {
    relayCancelCountDown().then(r => res.status(r.code).json(r.response))
  })

  app.get('/routes', (req, res) => {
    res.status(200).json(
      app._router.stack
        .filter(r => r.route)
        .map(
          ({
            route: {
              path,
              stack: [{ method }] = []
            } = {}
          }) => ({ method, path })
        )
    )
  })

  app.listen(bindPort, bindHost, () => {
    console.log(`Listening on ${bindHost}:${bindPort} ...`)
  })
}

async function main () {
  console.log(`  config-path : ${configPath}`)
  console.log(`    bind-host : ${bindHost}`)
  console.log(`    bind-port : ${bindPort}`)
  console.log(`        no-pi : ${noPi}`)
  console.log('Starting launch server...')

  try {
    const config = await getConfig()
    await runServer(config)
  } catch (error) {
    console.error('Error in ignition system:', error)
    process.exit(1)
  }
}

process.on('unhandledRejection', (reason, p) => {
  console.error(reason, 'Unhandled Rejection at Promise', p)
})

process.on('uncaughtException', err => {
  console.error(err, 'Uncaught Exception thrown')
  process.exit(1)
})

process.on('exit', () => console.log(`Exit ${process.pid}`))

main()
