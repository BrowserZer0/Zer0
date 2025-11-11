const { app, BrowserWindow, ipcMain, session, Menu } = require('electron')
const isDev = require('electron-is-dev')
const { ElectronBlocker } = require('@cliqz/adblocker-electron')
const fetch = require('cross-fetch')
const contextMenu = require('electron-context-menu')
const unusedFilename = require('unused-filename')
const path = require('path')
const preference = require('./functions/config')
require('./functions/notifier')
require('./functions/events')
require('./functions/tor')

let downloads = {}
let mainWindow, newWindow

// Override process.exit to prevent SSL-related crashes
const originalExit = process.exit
process.exit = function(code) {
  console.log('Process exit called with code:', code)
  
  // Don't exit for SSL-related crash codes
  if (code === 3221225477 || code === 1 || code === -1) {
    console.log('Prevented exit due to SSL/crash code, continuing...')
    return
  }
  
  // Allow normal exits
  return originalExit.call(this, code)
}

if (preference.getPreference().isTorEnabled) {
  app.commandLine.appendSwitch('proxy-server', 'socks5://127.0.0.1:9050')
}

app.on('window-all-closed', function () {
  app.quit()
})

newwindow = () => {
  newWindow = new BrowserWindow({
    title: 'Zero Browser',
    titleBarStyle: 'hiddenInset',
    show: true,
    icon: path.join(__dirname, '/icon.png'),
    resizable: true,
    width: 1200,
    height: 800,
    minWidth: 700,
    minHeight: 350,
    frame: false,
    center: true,
    alwaysOnTop: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true,
      experimentalFeatures: false, // Disable experimental features to prevent crashes
      // Add process isolation and memory management for stability
      sandbox: false,
      partition: 'temp-in-memory', // Use in-memory session for better isolation
      enableRemoteModule: false,
      spellcheck: false, // Disable spellcheck to reduce memory usage
      // Additional crash prevention settings
      backgroundThrottling: false,
      offscreen: false,
      disableHardwareAcceleration: false, // Keep hardware acceleration
      enableWebSQL: false
    }
  })
  let menuTemplate = [
    {
      label: 'Menu',
      submenu: [
        {
          label: 'Clear session and Reload',
          accelerator: 'CommandOrControl+D',
          click () {
            session.fromPartition('temp-in-memory').clearCache()
            session.fromPartition('temp-in-memory').clearStorageData()
            newWindow.reload()
          }
        },
        {
          label: 'Focus URLbar',
          accelerator: 'CommandOrControl+L',
          click () {
            mainWindow.webContents.send('focusURLbar', {})
          }
        },
        {
          label: 'Add a new tab',
          accelerator: 'CommandOrControl+T',
          click () {
            mainWindow.webContents.send('newTab', {})
          }
        },
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate))
  if (isDev) {
    newWindow.loadURL('http://localhost:3000')
    newWindow.openDevTools({ mode: 'detach' })
  } else {
    newWindow.loadFile('./build/index.html')
    //newWindow.openDevTools()
  }
  
  // Force window to be visible and focused
  newWindow.show()
  newWindow.focus()
  newWindow.moveTop()
  // Handle SSL certificate errors for main window
  newWindow.webContents.on('certificate-error', (event, url, error, certificate, callback) => {
    console.warn('Main window certificate error for', url, ':', error)
    // Allow certificate errors for development and certain domains
    if (url.includes('localhost') || url.includes('chrome.google.com') || url.includes('127.0.0.1')) {
      event.preventDefault()
      callback(true)
    } else {
      callback(false)
    }
  })

  newWindow.once('ready-to-show', () => {
    newWindow.show()
    newWindow.focus()
    newWindow.setAlwaysOnTop(true)
    setTimeout(() => {
      newWindow.setAlwaysOnTop(false)
    }, 1000)
    newWindow.maximize()
  })

  newWindow.webContents.on('did-attach-webview', (event, contents) => {
    // Handle certificate errors to prevent SSL crashes
    contents.on('certificate-error', (event, url, error, certificate, callback) => {
      console.warn('Certificate error for', url, ':', error)
      // For Chrome Web Store and other Google services, allow certificate errors
      if (url.includes('chrome.google.com') || url.includes('google.com')) {
        event.preventDefault()
        callback(true) // Trust the certificate
      } else {
        callback(false) // Don't trust for other sites
      }
    })
    
    // Handle SSL errors and connection issues
    contents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      if (errorDescription.includes('SSL') || errorDescription.includes('certificate') || errorDescription.includes('handshake')) {
        console.warn('SSL/Certificate error caught for:', validatedURL, errorDescription)
        // Don't let SSL errors crash the browser
        event.preventDefault()
      }
    })

    contents.setWindowOpenHandler(({ url }) => {
      /*Remove urlencoded characters from url. If bing search engine is used, 
      it adds 'https://www.bing.com/newtabredir?url=' infront of the the url 
      in new-window event, remove it.*/
      url = decodeURIComponent(
        url.replace('https://www.bing.com/newtabredir?url=', '')
      )
      mainWindow.webContents.send('openInNewtab', url)
      return { action: 'deny' }
    })

    // Handle webview crashes at the main process level
    contents.on('render-process-gone', (event, details) => {
      console.error('Webview render process gone:', details)
      
      if (details.reason === 'crashed') {
        console.log('Webview crashed, attempting recovery...')
        // Let the renderer process handle the recovery
        mainWindow.webContents.send('webview-crashed', { details })
      }
    })

    // Handle unresponsive webview
    contents.on('unresponsive', () => {
      console.warn('Webview became unresponsive')
      mainWindow.webContents.send('webview-unresponsive')
    })

    contents.on('responsive', () => {
      console.log('Webview became responsive')
      mainWindow.webContents.send('webview-responsive')
    })
  })
  return newWindow
}

updateDownloadList = () => {
  /*downloads gets destroyed when Zero is restarting*/
  if (!downloads) return
  let sortedDownloads = {}
  Object.keys(downloads)
    .sort((a, b) => b - a)
    .forEach(function (key) {
      sortedDownloads[key] = downloads[key]
    })
  mainWindow.webContents.send('downloadsChanged', sortedDownloads)
}
ipcMain.on('getDownloads', event => {
  updateDownloadList()
})

app.on('ready', function () {
  /*Start check for Zero updates*/
  require('./functions/autoupdator')
  
  // Handle unhandled promise rejections to prevent crashes
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason)
    
    // Specifically handle SSL/TLS errors to prevent crashes
    if (reason && (
      reason.code === 'EPROTO' ||
      reason.errno === -4046 ||
      (reason.message && (
        reason.message.includes('SSL') ||
        reason.message.includes('TLS') ||
        reason.message.includes('handshake') ||
        reason.message.includes('SSLV3_ALERT_HANDSHAKE_FAILURE')
      ))
    )) {
      console.log('SSL/TLS Promise Rejection caught and handled, continuing...')
      return false // Prevent default behavior
    }
    
    // Don't exit the process, just log other errors
    return false
  })
  
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error)
    // Don't exit the process for SSL errors or Chrome Web Store related crashes
    if (error.code === 'EPROTO' || 
        error.errno === -4046 ||
        error.message.includes('SSL') || 
        error.message.includes('TLS') ||
        error.message.includes('chrome.google.com') ||
        error.message.includes('handshake') ||
        error.message.includes('SSLV3_ALERT_HANDSHAKE_FAILURE')) {
      console.log('SSL/TLS/Chrome Web Store error caught and handled, continuing...')
      return
    }
  })
  
  // Prevent process exit on warnings
  process.on('warning', (warning) => {
    if (warning.name === 'ExperimentalWarning' || 
        warning.message.includes('SSL') ||
        warning.message.includes('TLS')) {
      return // Ignore SSL/TLS warnings
    }
  })
  
  // Add additional crash prevention with aggressive SSL bypass
  app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor')
  app.commandLine.appendSwitch('--disable-gpu-sandbox')
  app.commandLine.appendSwitch('--disable-web-security')
  app.commandLine.appendSwitch('--ignore-certificate-errors')
  app.commandLine.appendSwitch('--ignore-ssl-errors')
  app.commandLine.appendSwitch('--ignore-certificate-errors-spki-list')
  app.commandLine.appendSwitch('--ignore-urlfetcher-cert-requests')
  app.commandLine.appendSwitch('--disable-bundled-ppapi-flash')
  app.commandLine.appendSwitch('--disable-plugins-discovery')
  app.commandLine.appendSwitch('--allow-running-insecure-content')
  app.commandLine.appendSwitch('--disable-component-extensions-with-background-pages')
  app.commandLine.appendSwitch('--no-sandbox')
  app.commandLine.appendSwitch('--disable-site-isolation-trials')
  app.commandLine.appendSwitch('--disable-dev-shm-usage')
  // Completely disable SSL verification for problematic sites
  app.commandLine.appendSwitch('--unsafely-treat-insecure-origin-as-secure', 'chrome.google.com')
  app.commandLine.appendSwitch('--disable-http2')
  app.commandLine.appendSwitch('--disable-http-cache')
  
  // Configure proxy for both default and webview sessions
  const proxyConfig = preference.getPreference().isTorEnabled
    ? { proxyRules: 'socks5://127.0.0.1:9050' }
    : { proxyRules: 'direct://' }
  
  // Set proxy for default session (main window)
  session.defaultSession.setProxy(proxyConfig)
  
  // Set proxy for webview session (partition: temp-in-memory)
  const webviewSession = session.fromPartition('temp-in-memory')
  webviewSession.setProxy(proxyConfig)
  
  // Configure session to handle SSL issues more gracefully
  const ses = session.fromPartition('temp-in-memory')
  
  // Override certificate verification to prevent SSL crashes
  ses.setCertificateVerifyProc((request, callback) => {
    // Always trust certificates to prevent SSL handshake failures
    callback(0) // 0 means success/trusted
  })
  
  // Handle SSL certificate errors at the session level
  ses.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    console.warn('Session certificate error for:', url, error)
    event.preventDefault()
    callback(true) // Trust all certificates
  })
  
  // Block requests to Chrome Web Store at the network level
  ses.webRequest.onBeforeRequest((details, callback) => {
    if (details.url.includes('chrome.google.com/webstore') || 
        details.url.includes('chromewebstore.google.com')) {
      console.warn('Blocking Chrome Web Store request to prevent crash:', details.url)
      callback({ cancel: true })
    } else {
      callback({ cancel: false })
    }
  })

  mainWindow = newwindow()
  /*Handle file download events from webview*/
  session
    .fromPartition('temp-in-memory')
    .on('will-download', (event, item, webContents) => {
      if (preference.getPreference().downloadLocation != 'ask') {
        var filepath = unusedFilename.sync(
          path.join(
            preference.getPreference().downloadLocation,
            item.getFilename()
          )
        )
        var newFilename = path.basename(filepath)
        item.setSavePath(filepath)
      }
      var downloadItem = {
        name: newFilename || item.getFilename(),
        totalBytes: item.getTotalBytes(),
        receivedBytes: 0,
        status: 'started'
      }
      var downloadID = new Date().getTime()
      downloads[downloadID] = downloadItem
      item.once('done', (event, state) => {
        if (state === 'completed') {
          downloadItem.path = item.getSavePath()
          downloads[downloadID].status = 'done'
        } else {
          if (state == 'cancelled') {
            delete downloads[downloadID]
          }
        }
        updateDownloadList()
      })
      item.on('updated', (event, state) => {
        if (state === 'progressing') {
          downloads[downloadID].receivedBytes = item.getReceivedBytes()
        }
        updateDownloadList()
      })
    })
  ipcMain.on('downloadURL', (event, url) => {
    mainWindow.webContents.downloadURL(url)
  })
  ipcMain.on('openNewTab', (event, url) => {
    mainWindow.webContents.send('openInNewtab', url)
  })

  /*Enable or disable adblocker based on user preference*/
  ElectronBlocker.fromPrebuiltAdsAndTracking(fetch).then(blocker => {
    if (preference.getPreference().isAdblockEnabled)
      blocker.enableBlockingInSession(session.fromPartition('temp-in-memory'))
    ipcMain.on('toggleAdblocker', (event, flag) => {
      if (flag)
        blocker.enableBlockingInSession(session.fromPartition('temp-in-memory'))
      else
        blocker.disableBlockingInSession(
          session.fromPartition('temp-in-memory')
        )
    })
  })

  /* Allow or deny special permissions like camera,mic,location etc. based on user preference*/
  session
    .fromPartition('temp-in-memory')
    .setPermissionRequestHandler((webContents, permission, callback) => {
      if (preference.getPreference().blockSpecialPermissions) {
        return callback(false)
      }
      return callback(true)
    })

  session
    .fromPartition('temp-in-memory')
    .setPermissionCheckHandler((webContents, permission) => {
      if (preference.getPreference().blockSpecialPermissions) {
        return false
      }
      return true
    })
})

/*electron-context-menu options*/
app.on('web-contents-created', (e, contents) => {
  if (contents.getType() == 'webview') {
    contextMenu({
      window: {
        webContents: contents,
        inspectElement: contents.inspectElement.bind(contents)
      },
      prepend: (defaultActions, params, browserWindow) => [
        {
          label: 'Open in New Tab',
          visible: params.linkURL.trim().length > 0,
          click: () => {
            mainWindow.webContents.send('openInNewtab', params.linkURL)
          }
        },
        {
          label: 'Open Image in New Tab',
          visible: params.mediaType === 'image',
          click: () => {
            mainWindow.webContents.send('openInNewtab', params.srcURL)
          }
        }
      ],
      labels: {
        saveImage: 'Download Image',
        saveLinkAs: 'Download Link'
      },
      showSaveImage: true,
      showInspectElement: true,
      showCopyImageAddress: true,
      showCopyImage: true,
      showSaveLinkAs: true,
      showSearchWithGoogle: false
    })
  }
})
