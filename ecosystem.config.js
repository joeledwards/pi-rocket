function piRocket () {
  const name = 'pi-rocket'

  const srcDir = process.env.PI_ROCKET_SRC_DIR || '/home/joel/dev/pi-rocket'
  const appDir = process.env.PI_ROCKET_APP_DIR || '/opt/pi-rocket'
  const logDir = `${appDir}/logs`

  const outLog = `${logDir}/out.log`
  const errLog = `${logDir}/err.log`

  const configFile = `${appDir}/pubnub.json`
  const pidFile = `${appDir}/${name}.pid`
  const script = `${srcDir}/server.js`

  return {
    name,
    script,
    pid_file: pidFile,
    out_file: outLog,
    error_file: errLog,
    min_uptime: 2000,
    max_restarts: 0,
    restart_delay: 5000,
    env: {
      PI_ROCKET_BIND_PORT: 9080,
      PI_ROCKET_BIND_HOST: '127.0.0.1'
    },
    production_env: {
      PI_ROCKET_BIND_PORT: 8080,
      PI_ROCKET_BIND_HOST: '0.0.0.0',
      PI_ROCKET_CONFIG: configFile
    }
  }
}

module.exports = {
  apps: [piRocket()]
}
