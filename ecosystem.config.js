function piRocket () {
  const name = 'pi-rocket'

  const srcDir = process.env.PI_ROCKET_SRC_DIR || '/home/joel/dev/pi-rocket'
  const appDir = process.env.PI_ROCKET_APP_DIR || '/opt/pi-rocket'
  const script = `${srcDir}/server.js`

  const logDir = `${appDir}/logs`
  const infoLog = `${logDir}/info.log`
  const errorLog = `${logDir}/error.log`

  const pidFile = `${appDir}/${name}.pid`
  const configFile = `${appDir}/pubnub.json`

  return {
    name,
    script,
    cwd: srcDir,
    pid_file: pidFile,
    out_file: infoLog,
    error_file: errorLog,
    kill_timeout: 2500,
    min_uptime: 2000,
    max_restarts: 0,
    restart_delay: 5000,
    env: {
      PI_ROCKET_BIND_PORT: 9080,
      PI_ROCKET_BIND_HOST: '127.0.0.1',
      PI_ROCKET_NO_PI: true
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
