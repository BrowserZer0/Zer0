const EventEmitter = require('events')

if (!document) {
  throw Error('electron-tabs module must be called in renderer process')
}

// Inject styles
;(function () {
  const styles = `
    webview {
      position: absolute;
      visibility: hidden;
      width: 100%;
      height: 100%;
    }
    webview.visible {
      visibility: visible;
    }
  `
  let styleTag = document.createElement('style')
  styleTag.innerHTML = styles
  document.getElementsByTagName('head')[0].appendChild(styleTag)
})()

class TabGroup extends EventEmitter {
  constructor (args = {}) {
    super()
    let options = (this.options = {
      tabContainerSelector: args.tabContainerSelector || '.etabs-tabs',
      buttonsContainerSelector:
        args.buttonsContainerSelector || '.etabs-buttons',
      viewContainerSelector: args.viewContainerSelector || '.etabs-views',
      tabClass: args.tabClass || 'etabs-tab',
      viewClass: args.viewClass || 'etabs-view',
      closeButtonText: args.closeButtonText || '&#215;',
      newTab: args.newTab,
      newTabButtonText: args.newTabButtonText || '&#65291;',
      visibilityThreshold: args.visibilityThreshold || 0,
      ready: args.ready
    })
    this.tabContainer = document.querySelector(options.tabContainerSelector)
    this.viewContainer = document.querySelector(options.viewContainerSelector)
    this.tabs = []
    this.newTabId = 0
    TabGroupPrivate.initNewTabButton.bind(this)()
    TabGroupPrivate.initVisibility.bind(this)()
    if (typeof this.options.ready === 'function') {
      this.options.ready(this)
    }
  }

  addTab (args = this.options.newTab) {
    if (typeof args === 'function') {
      args = args(this)
    }
    let id = this.newTabId
    this.newTabId++
    let tab = new Tab(this, id, args)
    this.tabs.push(tab)
    // Don't call tab.activate() before a tab is referenced in this.tabs
    if (args.active === true) {
      tab.activate()
    }
    this.emit('tab-added', tab, this)
    return tab
  }

  getTab (id) {
    for (let i in this.tabs) {
      if (this.tabs[i].id === id) {
        return this.tabs[i]
      }
    }
    return null
  }

  getTabByPosition (position) {
    let fromRight = position < 0
    for (let i in this.tabs) {
      if (this.tabs[i].getPosition(fromRight) === position) {
        return this.tabs[i]
      }
    }
    return null
  }

  getTabByRelPosition (position) {
    position = this.getActiveTab().getPosition() + position
    if (position <= 0) {
      return null
    }
    return this.getTabByPosition(position)
  }

  getNextTab () {
    return this.getTabByRelPosition(1)
  }

  getPreviousTab () {
    return this.getTabByRelPosition(-1)
  }

  getTabs () {
    return this.tabs.slice()
  }

  eachTab (fn) {
    this.getTabs().forEach(fn)
    return this
  }

  getActiveTab () {
    if (this.tabs.length === 0) return null
    return this.tabs[0]
  }
}

const TabGroupPrivate = {
  initNewTabButton: function () {
    if (!this.options.newTab) return
    let container = document.querySelector(
      this.options.buttonsContainerSelector
    )
    let button = container.appendChild(document.createElement('button'))
    button.classList.add(`${this.options.tabClass}-button-new`)
    button.innerHTML = this.options.newTabButtonText
    button.addEventListener('click', this.addTab.bind(this, undefined), false)
  },

  initVisibility: function () {
    function toggleTabsVisibility (tab, tabGroup) {
      var visibilityThreshold = this.options.visibilityThreshold
      var el = tabGroup.tabContainer.parentNode
      if (this.tabs.length >= visibilityThreshold) {
        el.classList.add('visible')
      } else {
        el.classList.remove('visible')
      }
    }

    this.on('tab-added', toggleTabsVisibility)
    this.on('tab-removed', toggleTabsVisibility)
  },

  removeTab: function (tab, triggerEvent) {
    let id = tab.id
    for (let i in this.tabs) {
      if (this.tabs[i].id === id) {
        this.tabs.splice(i, 1)
        break
      }
    }
    if (triggerEvent) {
      this.emit('tab-removed', tab, this)
    }
    return this
  },

  setActiveTab: function (tab) {
    TabGroupPrivate.removeTab.bind(this)(tab)
    this.tabs.unshift(tab)
    this.emit('tab-active', tab, this)
    return this
  },

  activateRecentTab: function (tab) {
    if (this.tabs.length > 0) {
      this.tabs[0].activate()
    }
    return this
  }
}

class Tab extends EventEmitter {
  constructor (tabGroup, id, args) {
    super()
    this.tabGroup = tabGroup
    this.id = id
    this.title = args.title
    this.badge = args.badge
    this.iconURL = args.iconURL
    this.icon = args.icon
    this.iconList = []
    this.isNative = args.isNative || false
    this.comp = args.comp
    this.compProps = args.compProps
    this.closable = args.closable === false ? false : true
    this.webviewAttributes = args.webviewAttributes || {}
    this.webviewAttributes.src = args.src
    this.webviewAttributes.partition = 'temp-in-memory'
    this.src = args.src
    this.src = args.src
    this.tabElements = {}
    TabPrivate.initTab.bind(this)()
    if (args.isNative) {
      TabPrivate.initNativeView.bind(this)()
    } else {
      TabPrivate.initWebview.bind(this)()
    }

    if (args.visible !== false) {
      this.show()
    }
    if (typeof args.ready === 'function') {
      args.ready(this)
    }
  }

  setTitle (title) {
    if (this.isClosed) return
    let span = this.tabElements.title
    span.innerHTML = title
    span.title = title
    this.title = title
    this.emit('title-changed', title, this)
    return this
  }

  getTitle () {
    if (this.isClosed) return
    return this.title
  }

  setBadge (badge) {
    if (this.isClosed) return
    let span = this.tabElements.badge
    this.badge = badge

    if (badge) {
      span.innerHTML = badge
      span.classList.remove('hidden')
    } else {
      span.classList.add('hidden')
    }

    this.emit('badge-changed', badge, this)
  }

  getBadge () {
    if (this.isClosed) return
    return this.badge
  }
  setFavicon (iconList) {
    this.iconList = iconList
  }
  setIcon (iconURL, icon) {
    if (this.isClosed) return
    this.iconURL = iconURL
    this.icon = icon
    let span = this.tabElements.icon
    if (iconURL) {
      span.innerHTML = `<img src="${iconURL}" />`
      this.emit('icon-changed', iconURL, this)
    } else if (icon) {
      span.innerHTML = `<i class="${icon}"></i>`
      this.emit('icon-changed', icon, this)
    }

    return this
  }

  getIcon () {
    if (this.isClosed) return
    if (this.iconURL) return this.iconURL
    return this.icon
  }

  setPosition (newPosition) {
    let tabContainer = this.tabGroup.tabContainer
    let tabs = tabContainer.children
    let oldPosition = this.getPosition() - 1

    if (newPosition < 0) {
      newPosition += tabContainer.childElementCount

      if (newPosition < 0) {
        newPosition = 0
      }
    } else {
      if (newPosition > tabContainer.childElementCount) {
        newPosition = tabContainer.childElementCount
      }

      // Make 1 be leftmost position
      newPosition--
    }

    if (newPosition > oldPosition) {
      newPosition++
    }

    tabContainer.insertBefore(tabs[oldPosition], tabs[newPosition])

    return this
  }

  getPosition (fromRight) {
    let position = 0
    let tab = this.tab
    while ((tab = tab.previousSibling) != null) position++

    if (fromRight === true) {
      position -= this.tabGroup.tabContainer.childElementCount
    }

    if (position >= 0) {
      position++
    }

    return position
  }

  activate () {
    if (this.isClosed) return
    let activeTab = this.tabGroup.getActiveTab()
    if (activeTab) {
      activeTab.tab.classList.remove('active')
      if (activeTab.webview) {
        activeTab.webview.classList.remove('visible')
      }
      activeTab.emit('inactive', activeTab)
    }
    TabGroupPrivate.setActiveTab.bind(this.tabGroup)(this)
    this.tab.classList.add('active')
    if (this.webview) {
      this.webview.classList.add('visible')
      this.webview.focus()
    }
    this.emit('active', this)
    return this
  }

  show (flag) {
    if (this.isClosed) return
    if (flag !== false) {
      this.tab.classList.add('visible')
      this.emit('visible', this)
    } else {
      this.tab.classList.remove('visible')
      this.emit('hidden', this)
    }
    return this
  }

  hide () {
    return this.show(false)
  }

  flash (flag) {
    if (this.isClosed) return
    if (flag !== false) {
      this.tab.classList.add('flash')
      this.emit('flash', this)
    } else {
      this.tab.classList.remove('flash')
      this.emit('unflash', this)
    }
    return this
  }

  unflash () {
    return this.flash(false)
  }

  hasClass (classname) {
    return this.tab.classList.contains(classname)
  }

  removeNative (newURL) {
    this.isNative = false
    let tabGroup = this.tabGroup
    this.src = newURL
    this.webviewAttributes.src = newURL
    if (this.webview && tabGroup.viewContainer.contains(this.webview)) {
      tabGroup.viewContainer.removeChild(this.webview)
    }
    TabPrivate.initWebview.bind(this)()
  }

  close (force) {
    const abortController = new AbortController()
    const abort = () => abortController.abort()
    this.emit('closing', this, abort)

    const abortSignal = abortController.signal
    if (this.isClosed || (!this.closable && !force) || abortSignal.aborted)
      return

    this.isClosed = true
    let tabGroup = this.tabGroup
    tabGroup.tabContainer.removeChild(this.tab)
    if (this.webview && tabGroup.viewContainer.contains(this.webview)) {
      tabGroup.viewContainer.removeChild(this.webview)
    }
    let activeTab = this.tabGroup.getActiveTab()
    TabGroupPrivate.removeTab.bind(tabGroup)(this, true)

    this.emit('close', this)

    if (activeTab && activeTab.id === this.id) {
      TabGroupPrivate.activateRecentTab.bind(tabGroup)()
    }
  }
}

const TabPrivate = {
  initTab: function () {
    let tabClass = this.tabGroup.options.tabClass

    // Create tab element
    let tab = (this.tab = document.createElement('div'))
    tab.classList.add(tabClass)
    for (let el of ['icon', 'title', 'buttons', 'badge']) {
      let span = tab.appendChild(document.createElement('span'))
      span.classList.add(`${tabClass}-${el}`)
      this.tabElements[el] = span
    }

    this.setTitle(this.title)
    this.setBadge(this.badge)
    this.setIcon(this.iconURL, this.icon)
    TabPrivate.initTabButtons.bind(this)()
    TabPrivate.initTabClickHandler.bind(this)()

    this.tabGroup.tabContainer.appendChild(this.tab)
  },

  initTabButtons: function () {
    let container = this.tabElements.buttons
    let tabClass = this.tabGroup.options.tabClass
    if (this.closable) {
      let button = container.appendChild(document.createElement('button'))
      button.classList.add(`${tabClass}-button-close`)
      button.innerHTML = this.tabGroup.options.closeButtonText
      button.addEventListener('click', this.close.bind(this, false), false)
    }
  },

  initTabClickHandler: function () {
    // Mouse up
    const tabClickHandler = function (e) {
      if (this.isClosed) return
      if (e.which === 2) {
        this.close()
      }
    }
    this.tab.addEventListener('mouseup', tabClickHandler.bind(this), false)
    // Mouse down
    const tabMouseDownHandler = function (e) {
      if (this.isClosed) return
      if (e.which === 1) {
        if (e.target.matches('button')) return
        this.activate()
      }
    }
    this.tab.addEventListener(
      'mousedown',
      tabMouseDownHandler.bind(this),
      false
    )
  },

  initWebview: function () {
    try {
      // Pre-check for problematic URLs before creating webview
      if (this.src && (this.src.includes('chrome.google.com/webstore') || this.src.includes('chromewebstore.google.com'))) {
        console.warn('Pre-blocking Chrome Web Store URL, using iframe fallback:', this.src)
        this.initIframeFallback()
        return
      }
      
      this.webview = document.createElement('webview')

      // Error handling for webview events
      const tabWebviewDidFinishLoadHandler = function (e) {
        this.emit('webview-ready', this)
      }

      const tabWebviewDidFailLoadHandler = function (e) {
        console.log('Webview failed to load:', e)
        this.emit('webview-load-failed', this, e)
      }

      // Add crash detection handler
      const tabWebviewDidCrashHandler = function (e) {
        console.error('Webview crashed:', e)
        this.emit('webview-crashed', this, e)
        
        // Check if it's an SSL-related crash
        const isSSLCrash = this.src && (this.src.includes('chrome.google.com') || this.src.includes('https://'))
        
        if (isSSLCrash) {
          console.log('SSL-related crash detected, using fallback...')
          this.initIframeFallback()
        } else {
          // Attempt to recover by reloading
          setTimeout(() => {
            try {
              if (this.webview && !this.isClosed) {
                console.log('Attempting to recover from crash...')
                this.webview.reload()
              }
            } catch (error) {
              console.error('Failed to recover from crash:', error)
              // Fallback to iframe
              this.initIframeFallback()
            }
          }, 1000)
        }
      }

      // Add unresponsive detection handler
      const tabWebviewDidBecomeUnresponsiveHandler = function (e) {
        console.warn('Webview became unresponsive:', e)
        this.emit('webview-unresponsive', this, e)
      }

      const tabWebviewDidBecomeResponsiveHandler = function (e) {
        console.log('Webview became responsive again:', e)
        this.emit('webview-responsive', this, e)
      }

      // Add SSL certificate error handler
      const tabWebviewSSLErrorHandler = function (e) {
        console.warn('Webview SSL error:', e)
        // For Chrome Web Store, use fallback immediately
        if (this.src && this.src.includes('chrome.google.com')) {
          console.log('Chrome Web Store SSL error - switching to fallback')
          this.initIframeFallback()
        }
      }

      // Wrap event listeners in try-catch
      try {
        this.webview.addEventListener('did-finish-load', tabWebviewDidFinishLoadHandler.bind(this), false)
        this.webview.addEventListener('did-fail-load', tabWebviewDidFailLoadHandler.bind(this), false)
        this.webview.addEventListener('crashed', tabWebviewDidCrashHandler.bind(this), false)
        this.webview.addEventListener('unresponsive', tabWebviewDidBecomeUnresponsiveHandler.bind(this), false)
        this.webview.addEventListener('responsive', tabWebviewDidBecomeResponsiveHandler.bind(this), false)
        
        // Add SSL error detection
        this.webview.addEventListener('did-fail-load', (event) => {
          if (event.errorDescription && (
            event.errorDescription.includes('SSL') || 
            event.errorDescription.includes('certificate') ||
            event.errorDescription.includes('handshake') ||
            event.errorDescription.includes('EPROTO')
          )) {
            tabWebviewSSLErrorHandler.call(this, event)
          }
        }, false)
        
      } catch (error) {
        console.log('Failed to add webview event listeners:', error)
      }

      const tabWebviewDomReadyHandler = function (e) {
        try {
          this.emit('webview-dom-ready', this)
        } catch (error) {
          console.log('Webview dom-ready error:', error)
        }
      }

      try {
        this.webview.addEventListener('dom-ready', tabWebviewDomReadyHandler.bind(this), false)
      } catch (error) {
        console.log('Failed to add dom-ready listener:', error)
      }

      this.webview.classList.add(this.tabGroup.options.viewClass)
      
      // Set webview attributes with error handling
      if (this.webviewAttributes) {
        let attrs = this.webviewAttributes
        for (let key in attrs) {
          const attr = attrs[key]
          if (attr === false) continue
          try {
            this.webview.setAttribute(key, attr)
          } catch (error) {
            console.log('Failed to set webview attribute:', key, attr, error)
          }
        }
      }

      // Add stability attributes for complex sites
      try {
        // Improve stability for sites like Chrome Web Store
        this.webview.setAttribute('allowpopups', 'true')
        this.webview.setAttribute('disablewebsecurity', 'true')
        this.webview.setAttribute('webpreferences', 'allowRunningInsecureContent=true, experimentalFeatures=true')
      } catch (error) {
        console.log('Failed to set stability attributes:', error)
      }

      // Set src separately with URL filtering
      if (this.src) {
        try {
          // Block Chrome Web Store URLs completely to prevent crashes
          if (this.src.includes('chrome.google.com/webstore') || this.src.includes('chromewebstore.google.com')) {
            console.warn('Blocking Chrome Web Store URL to prevent crashes:', this.src)
            this.initIframeFallback()
            return
          }
          this.webview.src = this.src
        } catch (error) {
          console.log('Failed to set webview src:', error)
        }
      }

      this.tabGroup.viewContainer.appendChild(this.webview)
    } catch (error) {
      console.log('Critical error in webview initialization:', error)
      // Fallback to iframe if webview fails completely
      this.initIframeFallback()
    }
  },

  initIframeFallback: function () {
    console.log('Using iframe fallback due to webview issues')
    const iframe = (this.webview = document.createElement('iframe'))
    
    iframe.style.width = '100%'
    iframe.style.height = '100%'
    iframe.style.border = 'none'
    iframe.style.position = 'absolute'
    iframe.style.top = '0'
    iframe.style.left = '0'
    
    iframe.classList.add(this.tabGroup.options.viewClass)
    
    // Add better security and compatibility settings for iframe
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms allow-modals')
    iframe.setAttribute('allow', 'fullscreen; autoplay; clipboard-read; clipboard-write')
    iframe.setAttribute('loading', 'lazy')
    
    // Add error handling for iframe
    iframe.addEventListener('error', (e) => {
      console.error('Iframe fallback failed:', e)
      // Show a simple error page
      iframe.srcdoc = `
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h2>Unable to Load Page</h2>
            <p>This page could not be loaded. This may be due to security restrictions or network issues.</p>
            <p>URL: ${this.src}</p>
            <button onclick="window.parent.location.reload()">Try Again</button>
          </body>
        </html>
      `
    })
    
    if (this.src) {
      // For Chrome Web Store and other complex sites, use a proxy approach
      if (this.src.includes('chrome.google.com')) {
        console.warn('Chrome Web Store detected - using alternative approach due to SSL/security restrictions')
        iframe.srcdoc = `
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
                .container { text-align: center; max-width: 500px; padding: 40px; background: rgba(255,255,255,0.1); border-radius: 15px; backdrop-filter: blur(10px); }
                h2 { margin-bottom: 20px; font-size: 28px; }
                .warning { background: rgba(255,193,7,0.2); padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107; }
                ol { text-align: left; background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px; }
                .btn { background: #28a745; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 16px; margin: 10px; text-decoration: none; display: inline-block; }
                .btn:hover { background: #218838; }
                .btn-secondary { background: #6c757d; }
                .btn-secondary:hover { background: #545b62; }
              </style>
            </head>
            <body>
              <div class="container">
                <h2>🛡️ Chrome Web Store Access</h2>
                <div class="warning">
                  <strong>SSL/Security Restriction:</strong> The Chrome Web Store cannot be loaded directly due to SSL handshake failures and security policies in Zero Browser.
                </div>
                <p><strong>To install Chrome extensions in Zero Browser:</strong></p>
                <ol>
                  <li>Visit <strong>chrome.google.com/webstore</strong> in your regular browser</li>
                  <li>Find the extension you want</li>
                  <li>Use a CRX downloader tool (like CRX Extractor)</li>
                  <li>Download and extract the extension</li>
                  <li>Install it via Zero Browser's Extension Manager</li>
                </ol>
                <a href="zero://settings/extensions" class="btn">Open Extension Manager</a>
                <button onclick="window.close()" class="btn btn-secondary">Close Tab</button>
                <p style="margin-top: 20px; font-size: 12px; opacity: 0.8;">
                  This security measure prevents SSL-related crashes and protects your browsing experience.
                </p>
              </div>
            </body>
          </html>
        `
      } else {
        iframe.src = this.src
      }
    }

    this.tabGroup.viewContainer.appendChild(iframe)
  },
  initNativeView: function () {
    this.webview = document.createElement('div')
    this.webview.className = 'nativeView'
    this.tabGroup.viewContainer.appendChild(this.webview)
  }
}

//module.exports = TabGroup;
export default TabGroup
