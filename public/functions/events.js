const { app, ipcMain, shell, BrowserWindow } = require('electron')
const axios = require('axios')
const preference = require('./config')

/*User activated/deactivated tor*/
ipcMain.on('torWindow', async (event) => {
  console.log('[TOR-TOGGLE] Starting Tor toggle process...')
  
  // Toggle the preference
  const currentState = preference.getPreference().isTorEnabled
  const newState = !currentState
  
  console.log(`[TOR-TOGGLE] Current state: ${currentState}, New state: ${newState}`)
  
  preference.setPreference('isTorEnabled', newState)
  console.log('[TOR-TOGGLE] Preference saved')
  
  try {
    // Get the main window
    const mainWindow = BrowserWindow.getAllWindows()[0]
    
    if (!mainWindow) {
      console.error('[TOR-TOGGLE] ERROR: No main window found!')
      return
    }
    
    console.log('[TOR-TOGGLE] Main window found')
    
    const { session } = require('electron')
    
    // Proxy configuration
    const proxyConfig = newState ? {
      proxyRules: 'socks5://127.0.0.1:9050',
      pacScript: ''
    } : {
      proxyRules: 'direct://',
      pacScript: ''
    }
    
    // Update proxy settings dynamically for all sessions
    if (newState) {
      console.log('[TOR-TOGGLE] Enabling Tor proxy on port 9050')
    } else {
      console.log('[TOR-TOGGLE] Disabling Tor proxy - switching to direct connection')
    }
    
    // Update default session (main window)
    console.log('[TOR-TOGGLE] Setting proxy for default session...')
    await session.defaultSession.setProxy(proxyConfig)
    console.log('[TOR-TOGGLE] Default session proxy set')
    
    // Update webview session (partition: temp-in-memory)
    console.log('[TOR-TOGGLE] Setting proxy for webview session...')
    const webviewSession = session.fromPartition('temp-in-memory')
    await webviewSession.setProxy(proxyConfig)
    console.log('[TOR-TOGGLE] Webview session proxy set')
    
    // Clear cache for both sessions
    console.log('[TOR-TOGGLE] Clearing cache for default session...')
    await session.defaultSession.clearCache()
    console.log('[TOR-TOGGLE] Default session cache cleared')
    
    console.log('[TOR-TOGGLE] Clearing cache for webview session...')
    await webviewSession.clearCache()
    console.log('[TOR-TOGGLE] Webview session cache cleared')
    
    // Send success event immediately
    console.log(`[TOR-TOGGLE] Sending torStateChanged event to renderer with state: ${newState}`)
    mainWindow.webContents.send('torStateChanged', newState)
    console.log('[TOR-TOGGLE] Event sent successfully')
    
    console.log('[TOR-TOGGLE] Toggle process completed successfully!')
  } catch (error) {
    console.error('[TOR-TOGGLE] ERROR during toggle:', error)
    console.error('[TOR-TOGGLE] Error stack:', error.stack)
    // Send error state back to renderer
    if (mainWindow) {
      console.log(`[TOR-TOGGLE] Sending error state back: ${currentState}`)
      mainWindow.webContents.send('torStateChanged', currentState)
    }
  }
})

/*Return app version*/
ipcMain.on('appVersion', event => {
  event.returnValue = app.getVersion()
})

/* Open the downloaded file in native file manager*/
ipcMain.on('showItemInFolder', (event, arg) => {
  shell.showItemInFolder(arg)
})

/*catch maximize,minimize and close events*/
ipcMain.on('windowAction', (event, arg) => {
  if (arg == 'maxmin') {
    var window = BrowserWindow.getFocusedWindow()
    BrowserWindow.getFocusedWindow().isMaximized()
      ? window.unmaximize()
      : window.maximize()
  }
  if (arg == 'minimize') {
    BrowserWindow.getFocusedWindow().minimize()
  }
  if (arg == 'close') {
    BrowserWindow.getFocusedWindow().close()
  }
})

/*get system downloads directory path*/
ipcMain.on('getDownloadsDirectory', (event, arg, value) => {
  event.returnValue = app.getPath('downloads')
})

/*Return the platform on which Zero is running*/
ipcMain.on('getPlatform', event => {
  event.returnValue = process.platform
})

/*Send user feedback to sheets*/
ipcMain.on('sendFeedback', async (event, data) => {
  try {
    const formData = new FormData()
    for (const key in data) {
      formData.append(key, data[key])
    }
    
    await axios.post(
      'https://script.google.com/macros/s/AKfycbyS0EIojx1x0iBIlvia6Jr3gKdPg4bVVIretnHywu-NAm2gWGR2_onqwUVwcZmImW_7Yg/exec',
      formData,
      {
        headers: {
          'content-type': 'multipart/form-data'
        }
      }
    )
  } catch (error) {
    console.log(error)
  }
})
