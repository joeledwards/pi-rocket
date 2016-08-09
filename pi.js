const _ = require('lodash');
const Q = require('q');
const gpio = require('rpi-gpio');

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

const ON = true;
const OFF = false;

const EDGE_NONE = gpio.EDGE_NONE;
const EDGE_FALL = gpio.EDGE_FALLING;
const EDGE_RISE = gpio.EDGE_RISING;

const READ_EDGE = EDGE_FALL;
const WRITE_EDGE = EDGE_NONE;

const GPIO_READ = gpio.DIR_IN;
const GPIO_WRITE = gpio.DIR_OUT;

const pinMap = {};

// Setup the GPIO pin.
function setup(pin, ioDirection, edge) {
  var d = Q.defer();

  try {
    gpio.setup(pin, ioDirection, edge, (error) => {
      if (error) {
        d.reject(error);
      } else {
        d.resolve();
      }
    });
  } catch (err) {
    d.reject(err);
  }

  return d.promise;
}

// Read from the specified GPIO pin.
function read(pin) {
  var d = Q.defer();

  try {
    gpio.input(pin, (error, value) => {
      if (error) {
        d.reject(error);
      } else {
        d.resolve(value);
      }
    });
  } catch (err) {
    d.reject(err);
  }

  return d.promise;
}

// Write to the specified GPIO pin.
function write(pin, direction) {
  var d = Q.defer();

  try {
    gpio.output(pin, direction, (error) => {
      if (error) {
        d.reject(error);
      } else {
        d.resolve();
      }
    });
  } catch (err) {
    d.reject(err);
  }

  return d.promise;
}

// Get the current value of the specified GPIO pin.
function get(pin) {
  if (pinMap[pin] !== "read") {
    return setup(pin, GPIO_READ, READ_EDGE)
        .then(() => read(pin));
  } else {
    return read(pin);
  }
}

// Set the current value of the specified GPIO pin.
function set(pin, direction) {
  if (pinMap[pin] !== "write") {
    return setup(pin, GPIO_WRITE, WRITE_EDGE)
        .then(() => write(pin, direction));
  } else {
    return write(pin, direction);
  }
}

// Sleep (non-blocking) for the specified duration.
function sleep(duration) {
  const d = Q.defer();

  setTimeout(() => d.resolve(), duration);

  return d.promise;
}

// Set a GPIO pin to ON voltage.
function on(pin) {
  return set(pin, ON);
}

// Set a GPIO pin to OFF voltage.
function off(pin) {
  return set(pin, OFF);
}

// Pulse the pin to ON voltage for duration.
function pulse(pin, duration) {
  var d = Q.defer();

  on(pin)
  .then(() => {
    setTimeout(() => {
      off(pin)
      .then(() => d.resolve())
      .catch((error) => d.reject(error));
    }, duration);
  })
  .catch((error) => d.reject(error));

  return d.promise;
}

// Shutdown the GPIO lib.
function shutdown() {
  var d = Q.defer();

  gpio.destroy(() => d.resolve());

  return d.promise;
}

module.exports = {
  get: get,
  off: off,
  on: on,
  pulse: pulse,
  shutdown: shutdown,
  sleep: sleep,
};

