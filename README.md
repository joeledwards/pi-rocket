# pi-rocket

Launch software for model rockets for the Raspberry Pi written in Node.js

## Configuration

- `PI_ROCKET_CONFIG` - config file
- `PI_ROCKET_BIND_PORT` - port for HTTP API
- `PI_ROCKET_BIND_HOST` - host for HTTP API
- `PI_ROCKET_NO_PI` - for testing, runs `server.js` without GPIO

## Config File

The config file is JSON and contains only pubnub fields at this point.

- `pubKey` : pubnub publish key
- `subKey` : pubnub subscribe key
- `secret` : pubnub secret key

