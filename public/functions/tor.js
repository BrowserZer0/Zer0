const { app } = require('electron')
const path = require('path')

/*spawn the tor process by executing the tor binary bundled with Zero*/
async function connect_tor () {
  const root = process.cwd()
  const { isPackaged } = app
  var execPath
  var dataDir
  var geoipFile
  var geoip6File
  
  if (process.platform === 'darwin') {
    if (isPackaged) {
      execPath = path.join(process.resourcesPath, 'mac', 'tor', 'tor')
      dataDir = path.join(process.resourcesPath, 'mac', 'tor', 'data')
      geoipFile = path.join(dataDir, 'geoip')
      geoip6File = path.join(dataDir, 'geoip6')
    } else {
      execPath = path.join(root, './resources', 'mac', 'tor', 'tor')
      dataDir = path.join(root, './resources', 'mac', 'tor', 'data')
      geoipFile = path.join(dataDir, 'geoip')
      geoip6File = path.join(dataDir, 'geoip6')
    }
  }
  if (process.platform === 'win32') {
    if (isPackaged) {
      execPath = path.join(process.resourcesPath, 'win', 'Tor', 'tor.exe')
      dataDir = path.join(process.resourcesPath, 'win', 'data')
      geoipFile = path.join(dataDir, 'geoip')
      geoip6File = path.join(dataDir, 'geoip6')
    } else {
      execPath = path.join(root, './resources', 'win', 'Tor', 'tor.exe')
      dataDir = path.join(root, './resources', 'win', 'data')
      geoipFile = path.join(dataDir, 'geoip')
      geoip6File = path.join(dataDir, 'geoip6')
    }
  }
  if (process.platform === 'linux') {
    if (isPackaged) {
      execPath = path.join(process.resourcesPath, 'lin', 'tor', 'tor')
      dataDir = path.join(process.resourcesPath, 'lin', 'tor', 'data')
      geoipFile = path.join(dataDir, 'geoip')
      geoip6File = path.join(dataDir, 'geoip6')
    } else {
      execPath = path.join(root, './resources', 'lin', 'tor', 'tor')
      dataDir = path.join(root, './resources', 'lin', 'tor', 'data')
      geoipFile = path.join(dataDir, 'geoip')
      geoip6File = path.join(dataDir, 'geoip6')
    }
  }
  
  console.log(execPath)
  
  // Tor configuration arguments
  const torArgs = [
    '--GeoIPFile', geoipFile,
    '--GeoIPv6File', geoip6File
  ]
  
  spawn = require('child_process').spawn
  var child = spawn(execPath, torArgs, {})
  var scriptOutput = ''

  child.stdout.setEncoding('utf8')
  child.stdout.on('data', function (data) {
    data.search('100%')
    console.log('stdout: ' + data)
    data = data.toString()
    scriptOutput += data
  })

  child.stderr.setEncoding('utf8')
  child.stderr.on('data', function (data) {
    console.log('stderr: ' + data)
    data = data.toString()
    scriptOutput += data
  })

  child.on('close', function (code) {
    console.log('closing code: ' + code)
    console.log('Full output of script: ', scriptOutput)
  })
}
connect_tor()
