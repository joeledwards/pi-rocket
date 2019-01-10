const P = require('bluebird')
const gpio = require('rpi-gpio')

/* List of pins

+3.3v             1 --  2  +5v
GPIO 2 / SDA1     3 --  4  +5v
GPIO 3 / SCL1     5 --  6  GND
GPIO 4            7 --  8  GPIO 14 / TXD0
GND               9 -- 10  GPIO 15 / RXD0
GPIO 17          11 -- 12  GPIO 18
GPIO 27          13 -- 14  GND
GPIO 22          15 -- 16  GPIO 23
+3.3v            17 -- 18  GPIO 24
GPIO 10 / MOSI   19 -- 20  GND
GPIO 9  / MISO   21 -- 22  GPIO 25
GPIO 11 / SCLK   23 -- 24  GPIO 8  / CE0#
GND              25 -- 26  GPIO 7  / CE1#
GPIO 0  / ID_SD  27 -- 28  GPIO 1  / ID_SC
GPIO 5           29 -- 30  GND
GPIO 6           31 -- 32  GPIO 12
GPIO 13          33 -- 34  GND
GPIO 19 / MISO   35 -- 36  GPIO 16 / CE2#
GPIO 26          37 -- 38  GPIO 20 / MOSI
GND              39 -- 40  GPIO 21 / SCLK

*/

const ON = true
const OFF = false

const EDGE_NONE = gpio.EDGE_NONE
const EDGE_FALL = gpio.EDGE_FALLING
// const EDGE_RISE = gpio.EDGE_RISING

const READ_EDGE = EDGE_FALL
const WRITE_EDGE = EDGE_NONE

const GPIO_READ = gpio.DIR_IN
const GPIO_WRITE = gpio.DIR_OUT

const pinMap = {}

async sleep (duration) {
  return new P(resolve => setTimeout(resolve, duration))
}

// Setup the GPIO pin.
async function setup (pin, ioDirection, edge) {
  return new P((resolve, reject) => {
    gpio.setup(pin, ioDirection, edge, (error) => {
      if (error) {
        console.error(`Error setting pin ${pin} to direction ${ioDirection}:`, error)
        reject(error)
      } else {
        console.log(`Set pin ${pin} to direction ${ioDirection}:`)
        resolve()
      }
    })
  })
}

// Read from the specified GPIO pin.
async function read (pin) {
  return P.promisify(gpio.read)(pin)
}

// Write to the specified GPIO pin.
async function write (pin, direction) {
  return P.promisify(gpio.write)(pin, direction)
}

// Get the current value of the specified GPIO pin.
async function get (pin) {
  if (pinMap[pin] !== 'read') {
    await setup(pin, GPIO_READ, READ_EDGE)
    pinMap[pin] = 'read'
    return read(pin)
  } else {
    return read(pin)
  }
}

// Set the current value of the specified GPIO pin.
async function set (pin, direction) {
  if (pinMap[pin] !== 'write') {
    await setup(pin, GPIO_WRITE, WRITE_EDGE)
    pinMap[pin] = 'write'
    return write(pin, direction)
  } else {
    return write(pin, direction)
  }
}

// Set a GPIO pin to ON voltage.
async function on (pin) {
  return set(pin, ON)
}

// Set a GPIO pin to OFF voltage.
async function off (pin) {
  return set(pin, OFF)
}

// Pulse the pin to ON voltage for duration.
async function pulse (pin, duration) {
  await on(pin)
  await sleep(duration)
  await off(pin)
}

// Shutdown the GPIO lib.
async function shutdown () {
  return new P(resolve => gpio.destroy(() => resolve()))
}

function listen (listener) {
  gpio.on('change', function (channel, value) {
    listener(channel, value)
  })
}

module.exports = {
  get: get,
  listen: listen,
  off: off,
  on: on,
  pulse: pulse,
  shutdown: shutdown
}
