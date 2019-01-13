require('log-a-log')()

const fs = require('fs')
const PubNub = require('pubnub')
const express = require('express')

const configPath = coalesce(process.env.PI_ROCKET_CONFIG, 'pubnub.json')
const bindPort = coalesce(process.env.PI_ROCKET_BIND_PORT, 8080)
const bindHost = coalesce(process.env.PI_ROCKET_BIND_HOST, '0.0.0.0')

let config
async function getConfig () {
  if (!config) {
    config = new Promise((resolve, reject) => {
      fs.readFile(configPath, (error, raw) => {
        try {
          if (error) {
            reject(error)
          } else {
            resolve(JSON.parse(raw))
          }
        } catch (err) {
          reject(err)
        }
      })
    })
  }

  return config
}

function coalesce () {
  return Object.values(arguments).filter(v => v !== null && v !== undefined)[0]
}

function runServer ({ pubKey, subKey }) {
  const pubnub = new PubNub({
    publish_key: pubKey,
    subscribe_key: subKey
  })

  // Publish a message to the control bus
  async function publish (channel, command) {
    return new Promise(resolve => {
      pubnub.publish({
        channel,
        message: command
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
    message: messageHandler
  })

  let statusRequests = []

  function messageHandler (msg) {
    const { channel, message } = msg

    switch (channel) {
      case 'pi-rocket-control':
        // Log all notifications from the ignition system.
        console.log(`Received a control message: ${message}`)
        break
      case 'pi-rocket-notifications':
        // Echo all control commands back to the controller.
        console.log(`Received a notification message: ${message}`)
        requests = statusRequests
        statusRequests = []
        requests.forEach(r => r.resolve(message))
        break
    }
  }

  pubnub.subscribe({
    channels: ['pi-rocket-control', 'pi-rocket-notifications']
  })

  const app = express()

  // Serve up the control website
  app.use('/control', express.static('public'))

  // Pulse relay
  app.post('/pulse', async (req, res) => {
    try {
      await publish('pi-rocket-control', 'relay-pulse')
      res.status(200).json({ code: 200 })
    } catch (error) {
      console.error('Error pulsing the relay:', error)
      res.status(500).json({ code: 500 })
    }
  })

  // Switch relay on
  app.post('/on', async (req, res) => {
    try {
      await publish('pi-rocket-control', 'relay-on')
      res.status(200).json({ code: 200 })
    } catch (error) {
      console.error('Error turning the relay on:', error)
      res.status(500).json({ code: 500 })
    }
  })

  // Switch relay off
  app.post('/off', async (req, res) => {
    try {
      await publish('pi-rocket-control', 'relay-off')
      res.status(200).json({ code: 200 })
    } catch (error) {
      console.error('Error turning the relay off:', error)
      res.status(500).json({ code: 500 })
    }
  })

  // Prompt delivery of relay status
  app.post('/status', async (req, res) => {
    try {
      await publish('pi-rocket-control', 'status')
      res.status(200).json({ code: 200 })
    } catch (error) {
      console.error('Error fetching relay status:', error)
      res.status(500).json({ code: 500 })
    }
  })

  // Fetch latest relay status
  app.get('/status', async (req, res) => {
    publish('pi-rocket-control', 'status')
    const status = await new Promise(resolve => {
      statusRequests.push({ resolve })
      setTimeout(() => resolve('timeout'), 5000)
    })
    res.status(200).json({ code: 200, status })
  })

  // Initiate count-down
  app.post('/count-down', async (req, res) => {
    try {
      await publish('pi-rocket-control', 'count-down')
      res.status(200).json({ code: 200 })
    } catch (error) {
      console.error('Error initializing count-down:', error)
      res.status(500).json({ code: 500 })
    }
  })

  // Cancel count-down
  app.post('/cancel-count-down', async (req, res) => {
    try {
      await publish('pi-rocket-control', 'cancel-count-down')
      res.status(200).json({ code: 200 })
    } catch (error) {
      console.error('Error cancelling count-down:', error)
      res.status(500).json({ code: 500 })
    }
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
  console.log('Starting control server...')

  try {
    const config = await getConfig()
    await runServer(config)
  } catch (error) {
    console.error('Error with launch control server:', error)
    process.exit(1)
  }
}

process
  .on('unhandledRejection', (reason, p) => {
    console.error(reason, 'Unhandled Rejection at Promise', p)
  })
  .on('uncaughtException', err => {
    console.error(err, 'Uncaught Exception thrown')
    process.exit(1)
  })
  .on('exit', () => console.log(`Exit ${process.pid}`))

main()
