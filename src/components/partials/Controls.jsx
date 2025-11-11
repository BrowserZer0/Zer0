import React from 'react'
import ReactDOM from 'react-dom/client'
import DownloadPopup from './DownloadPopup'
import BlankTab from '../nativePages/BlankTab'
import '../../assets/css/controls.css'
import parseUrlInput from '../../functions/parseUrlInput'
import validateZeroProtocol from '../../functions/validateZeroProtocol'
import Settings from '../nativePages/Settings'
import loadFavicon from '../../functions/loadFavicon'
import torIcon from '../../assets/images/tor.png'

class Controls extends React.Component {
  constructor (props) {
    super(props)
    this.openDownloadsPage = this.openDownloadsPage.bind(this)
    this.handleClick = this.handleClick.bind(this)
    this.handleOutsideClick = this.handleOutsideClick.bind(this)
    this.toggleTor = this.toggleTor.bind(this)
    this.torSafetyTimeout = null
    this.state = {
      tabGroup: null,
      activeTab: 0,
      tab: null,
      canGoBack: false,
      canGoForward: false,
      tabs: [],
      popupVisible: false,
      searchEngine: window.preloadAPI.send('getPreference', 'searchEngine', true) || 'ddg',
      isSiteSecure: true,
      isFirstRender: true,
      isfullScreen: false,
      istabWebview: false,
      isTorEnabled: window.preloadAPI.send('getPreference', 'isTorEnabled', true),
      torToggling: false
    }
  }
  static getDerivedStateFromProps (nextProps, prevState) {
    if (nextProps.tabGroup !== prevState.tabGroup) {
      return { tabGroup: nextProps.tabGroup }
    }
    return null
  }
  componentDidMount () {
    window.preloadAPI.receive('focusURLbar', () => {
      if (this.inputField) {
        this.inputField.focus()
      }
    })
    window.preloadAPI.receive('newTab', () => {
      let newtab = this.state.tabGroup.addTab({
        title: 'Home',
        src: '',
        icon: 'fa fa-grip-horizontal',
        iconURL: 'icon.png',
        isNative: true,
        comp: BlankTab
      })
      newtab.activate()
    })
    // Listen for Tor state changes from settings page
    window.preloadAPI.receive('torStateChanged', (isTorEnabled) => {
      console.log('[CONTROLS] Received torStateChanged event, isTorEnabled:', isTorEnabled)
      console.log('[CONTROLS] Current torToggling state:', this.state.torToggling)
      
      // Clear the safety timeout since we got a response
      if (this.torSafetyTimeout) {
        console.log('[CONTROLS] Clearing safety timeout')
        clearTimeout(this.torSafetyTimeout)
        this.torSafetyTimeout = null
      } else {
        console.log('[CONTROLS] No safety timeout to clear')
      }
      
      console.log('[CONTROLS] Updating state - isTorEnabled:', isTorEnabled, ', torToggling: false')
      this.setState({ isTorEnabled, torToggling: false })
      console.log('[CONTROLS] State update called')
    })
  }
  componentDidUpdate (prevProps) {
    if (prevProps.tabGroup !== this.props.tabGroup) {
      this.setState({ tabGroup: this.props.tabGroup })
      this.tabGroupEvents(this.state.tabGroup)
    }
  }
  handleOutsideClick (e) {
    if (this.node.contains(e.target)) {
      return
    }
    this.handleClick()
  }
  handleClick () {
    if (!this.state.popupVisible) {
      document.addEventListener('click', this.handleOutsideClick, false)
    } else {
      document.removeEventListener('click', this.handleOutsideClick, false)
    }
    this.setState(prevState => ({
      popupVisible: !prevState.popupVisible
    }))
  }
  toggleTor () {
    console.log('[CONTROLS] toggleTor called')
    console.log('[CONTROLS] Current state - isTorEnabled:', this.state.isTorEnabled, ', torToggling:', this.state.torToggling)
    
    if (this.state.torToggling) {
      console.log('[CONTROLS] Already toggling, ignoring click')
      return // Prevent multiple clicks during toggle
    }
    
    // Clear any existing timeout
    if (this.torSafetyTimeout) {
      console.log('[CONTROLS] Clearing existing safety timeout')
      clearTimeout(this.torSafetyTimeout)
    }
    
    console.log('[CONTROLS] Setting torToggling to true')
    this.setState({ torToggling: true })
    
    const newTorState = !this.state.isTorEnabled
    console.log('[CONTROLS] New Tor state will be:', newTorState)
    
    // Update state immediately for UI feedback
    this.setState({ isTorEnabled: newTorState })
    
    // Show a notification or overlay
    const message = newTorState ? 'Activating Tor Network...' : 'Deactivating Tor Network...'
    console.log('[CONTROLS]', message)
    
    // Safety timeout in case reload gets stuck (10 seconds)
    console.log('[CONTROLS] Setting safety timeout (10s)')
    this.torSafetyTimeout = setTimeout(() => {
      console.warn('[CONTROLS] Tor toggle timed out (10s), resetting state')
      console.log('[CONTROLS] Reverting to original state:', !newTorState)
      this.setState({ 
        torToggling: false,
        isTorEnabled: !newTorState // Revert to original state
      })
      this.torSafetyTimeout = null
    }, 10000)
    
    // Send the toggle request - window will reload instead of full app restart
    setTimeout(() => {
      console.log('[CONTROLS] Sending torWindow IPC event')
      window.preloadAPI.send('torWindow')
      console.log('[CONTROLS] IPC event sent')
      // The torStateChanged event will clear the timeout and update state
    }, 100)
  }
  updateTab = tab => {
    let tabs = [...this.state.tabs]
    tabs.push({
      id: tab.id,
      url: tab.webview.src,
      inputURL: tab.webview.src,
      tab
    })
    this.setState({ tabs }, () => {
      if (!tab.isNative) this.tabEvents(tab)
    })
  }
  tabEvents = tab => {
    tab.webview.addEventListener('did-start-loading', () => {
      tab.setIcon('', 'loader-rev')
      let tabs = [...this.state.tabs]
      if (tabs[tab.id]) {
        tabs[tab.id].isNative = false
      }
    })
    tab.webview.addEventListener('will-navigate', () => {
      tab.setIcon('', 'loader-rev')
    })
    tab.webview.addEventListener('load-commit', e => {
      tab.setIcon('', 'loader')
    })
    tab.webview.addEventListener('page-title-updated', () => {
      const newTitle = tab.webview.getTitle()
      tab.setTitle(newTitle)
    })
    loadFavicon(tab)

    tab.webview.addEventListener('did-stop-loading', () => {
      if (tab.iconList.length) {
        tab.setIcon(tab.iconList[0], '')
      }
      let tabs = [...this.state.tabs]
      if (!tabs[tab.id]) return // Safety check
      
      let url = tab.webview.src
      tabs[tab.id].url = url
      /* If the URI is a pdf, download the pdf as pdf won't be loading in an in memory session */
      if (url.endsWith('.pdf')) {
        window.preloadAPI.send('downloadURL', url, false)
      }
      tabs[tab.id].inputURL = tab.webview.src
      tabs[tab.id].canGoBack = tab.webview.canGoBack()
      tabs[tab.id].canGoForward = tab.webview.canGoForward()
      this.setState({ tabs }, () => {
        if (tab.id === this.state.activeTab) {
          const locationInput = document.getElementById('location')
          if (locationInput) {
            locationInput.value = this.state.tabs[tab.id]?.url
          }
          this.secureSiteCheck()
        }
      })
    })
    tab.webview.addEventListener('enter-html-full-screen', e => {
      this.setState({ isfullScreen: true })
      this.props.changeFullscreen()
    })
    tab.webview.addEventListener('leave-html-full-screen', e => {
      this.setState({ isfullScreen: false })
      this.props.changeFullscreen()
    })
    tab.webview.addEventListener('did-fail-load', e => {
      var data =
        "'<h3>Error loading page</h3><p>" +
        e.errorCode +
        ': ' +
        e.errorDescription +
        "</p>'"
      if (e.isMainFrame) {
        tab.webview.executeJavaScript('document.body.innerHTML+=' + data)
        setTimeout(() => {
          tab.setIcon('', 'fa fa-exclamation-circle')
        }, 30)
      }
    })

    // Handle webview crashes
    tab.webview.addEventListener('crashed', e => {
      console.error('Tab webview crashed:', e)
      tab.setIcon('', 'fa fa-exclamation-triangle')
      
      // Show crash message
      var crashData = "'<div style=\"padding: 20px; text-align: center; font-family: Arial, sans-serif;\"><h2>Page Crashed</h2><p>This page has crashed. <a href=\"javascript:location.reload()\">Click here to reload</a></p></div>'"
      try {
        tab.webview.executeJavaScript('document.body.innerHTML=' + crashData)
      } catch (error) {
        console.error('Failed to show crash message:', error)
      }
    })

    // Handle unresponsive webview
    tab.webview.addEventListener('unresponsive', e => {
      console.warn('Tab webview became unresponsive:', e)
      tab.setIcon('', 'fa fa-hourglass-half')
    })

    tab.webview.addEventListener('responsive', e => {
      console.log('Tab webview became responsive again:', e)
      // Restore normal icon when responsive
      if (tab.iconList.length) {
        tab.setIcon(tab.iconList[0], '')
      }
    })
  }
  tabGroupEvents = tabGroup => {
    tabGroup.on('tab-added', (tab, tabGroup) => {
      if (tab.isNative) {
        // Create a container div for React to render into
        if (!tab.webview.querySelector('.react-root-container')) {
          const container = document.createElement('div')
          container.className = 'react-root-container'
          container.style.width = '100%'
          container.style.height = '100%'
          tab.webview.appendChild(container)
          tab.webview._reactRoot = ReactDOM.createRoot(container)
        }
        tab.webview._reactRoot.render(
          <tab.comp
            submitURL={this.submitURL}
            handleChange={this.handleChange}
            handleSearchEngineChange={this.handleSearchEngineChange}
            tabGroup={tabGroup}
            tab={tab}
            {...tab.compProps}
          />
        )
        document.getElementById('location').value = tab.webviewAttributes.src
      }
      this.updateTab(tab)
    })

    tabGroup.on('tab-active', (tab, tabGroup) => {
      this.setState({ istabWebview: tab.isNative })
      if (tab.src === '') {
        if (this.state.isFirstRender)
          setTimeout(() => {
            this.setState({ isFirstRender: false })
            if (this.inputField) {
              this.inputField.focus()
            }
          }, 500)
        else if (this.inputField) {
          this.inputField.focus()
        }
      }
      const locationInput = document.getElementById('location')
      if (locationInput) {
        locationInput.value = this.state.tabs[tab.id]?.url || tab.webviewAttributes.src
      }
      this.secureSiteCheck()
      this.setState({ activeTab: tab.id })
      if (tab.isNative) {
        // Create a container div for React to render into
        if (!tab.webview.querySelector('.react-root-container')) {
          const container = document.createElement('div')
          container.className = 'react-root-container'
          container.style.width = '100%'
          container.style.height = '100%'
          tab.webview.appendChild(container)
          tab.webview._reactRoot = ReactDOM.createRoot(container)
        }
        tab.webview._reactRoot.render(
          <tab.comp
            submitURL={this.submitURL}
            handleChange={this.handleChange}
            handleSearchEngineChange={this.handleSearchEngineChange}
            tabGroup={tabGroup}
            tab={tab}
            {...tab.compProps}
          />
        )
      }
    })

    tabGroup.on('tab-removed', (tab, tabGroup) => {
      if (tabGroup.getTabs().length === 0) {
        let newtab = tabGroup.addTab({
          title: 'Home',
          src: '',
          icon: 'fa fa-grip-horizontal',
          iconURL: 'icon.png',
          isNative: true,
          comp: BlankTab
        })
        newtab.activate()
      }
    })
    this.props.listenerReady()
  }
  handleChange = event => {
    let tabs = [...this.state.tabs]
    if (tabs[this.state.activeTab]) {
      tabs[this.state.activeTab].inputURL = event.target.value
      this.setState({ tabs })
    }
  }
  handleSearchEngineChange = searchEngine => {
    this.setState({ searchEngine: searchEngine })
  }
  submitURL = e => {
    e.preventDefault()
    let id = this.state.activeTab
    let sTab = this.state.tabs[id]
    
    // Safety check: ensure tab exists
    if (!sTab || !sTab.tab) {
      console.warn('Cannot submit URL: active tab not found')
      return
    }
    
    let url = sTab.inputURL
    if (!url) return
    
    // Block Chrome Web Store URLs to prevent crashes
    if (url.includes('chrome.google.com/webstore') || url.includes('chromewebstore.google.com')) {
      console.warn('Chrome Web Store URL blocked to prevent crashes:', url)
      // Navigate to a safe fallback instead
      this.openExtensionsHelp()
      return
    }
    if (url.startsWith('zero://')) {
      validateZeroProtocol(this.state.tabGroup, sTab.tab, url)
      return
    }
    url = parseUrlInput(sTab.inputURL, this.state.searchEngine)
    const locationInput = document.getElementById('location')
    if (locationInput) {
      locationInput.value = url
    }
    if (sTab.tab.isNative) {
      sTab.tab.removeNative(url)
      this.tabEvents(sTab.tab)
      sTab.tab.activate()
    } else {
      sTab.tab.webview.loadURL(url)
    }
  }
  goForward = () => {
    if (this.state.tabs[this.state.activeTab]?.tab?.webview) {
      this.state.tabs[this.state.activeTab].tab.webview.goForward()
    }
  }
  goBack = () => {
    if (this.state.tabs[this.state.activeTab]?.tab?.webview) {
      this.state.tabs[this.state.activeTab].tab.webview.goBack()
    }
  }
  reloadWebv = () => {
    if (this.state.tabs[this.state.activeTab]?.tab?.webview) {
      this.state.tabs[this.state.activeTab].tab.webview.reload()
    }
  }
  zoomInWebv = () => {
    if (this.state.tabs[this.state.activeTab]?.tab?.isNative) return
    if (!this.state.tabs[this.state.activeTab]?.tab?.webview) return
    let zoomLevel = this.state.tabs[
      this.state.activeTab
    ].tab.webview.getZoomLevel()
    this.state.tabs[this.state.activeTab].tab.webview.setZoomLevel(
      zoomLevel + 1
    )
  }
  zoomOutWebv = () => {
    if (this.state.tabs[this.state.activeTab]?.tab?.isNative) return
    if (!this.state.tabs[this.state.activeTab]?.tab?.webview) return
    let zoomLevel = this.state.tabs[
      this.state.activeTab
    ].tab.webview.getZoomLevel()
    this.state.tabs[this.state.activeTab].tab.webview.setZoomLevel(
      zoomLevel - 1
    )
  }
  activeWebView = () => {
    if (this.state.tabs[this.state.activeTab].tab.isNative) return
    this.state.tabs[this.state.activeTab].tab.webview.setZoomLevel(0)
  }
  removeMenu = () => {
    const menuDropdown = document.getElementById('menuDropdown')
    if (menuDropdown) {
      menuDropdown.classList.remove('show')
    }
  }
  secureSiteCheck = () => {
    const locationInput = document.getElementById('location')
    if (!locationInput) return
    
    var url = locationInput.value
    if (url && (url.startsWith('https://') || url.startsWith('zero://'))) {
      this.setState({ isSiteSecure: true })
    } else {
      this.setState({ isSiteSecure: false })
    }
  }
  openDownloadsPage () {
    let newtab = this.state.tabGroup.addTab({
      src: '',
      title: 'Downloads',
      isNative: true,
      iconURL: 'icon.png',
      comp: Settings,
      compProps: { calledBy: 'downloadpopup' }
    })
    newtab.activate()
  }
  openExtensionsHelp () {
    let newtab = this.state.tabGroup.addTab({
      src: '',
      title: 'Extension Installation Help',
      isNative: true,
      iconURL: 'icon.png',
      comp: Settings,
      compProps: { calledBy: 'extensions' }
    })
    newtab.activate()
  }
  selectOnFocus = event => event.target.select()
  render () {
    return (
      <>
        <div id='controls' className={this.state.isfullScreen ? 'd-none' : ''}>
          <button
            id='back'
            title='Go Back'
            onClick={this.goBack}
            disabled={!this.state.tabs[this.state.activeTab]?.canGoBack}
          >
            <i className='fas fa-chevron-left' />
          </button>
          <button
            id='forward'
            title='Go Forward'
            onClick={this.goForward}
            disabled={!this.state.tabs[this.state.activeTab]?.canGoForward}
          >
            <i className='fas fa-chevron-right' />
          </button>
          {/* <button id="home" onClick={this.goHome} title="Go Home"><i className="fas fa-home" /></button> */}
          <button
            id='reload'
            title='Reload'
            onClick={this.reloadWebv}
            disabled={this.state.istabWebview}
          >
            <i className='fas fa-redo' />
          </button>

          <form
            className='text-center'
            id='location-form'
            onSubmit={this.submitURL}
          >
            <div id='center-column'>
              <button className='urlInfo d-none'>
                {this.state.isSiteSecure ? (
                  <i className='fa fa-lock secure-site' />
                ) : (
                  <i className='fa fa-globe' />
                )}
              </button>
              <input
                id='location'
                type='text'
                spellCheck='false'
                ref={input => (this.inputField = input)}
                onFocus={this.selectOnFocus}
                onChange={this.handleChange}
                defaultValue={'loading'}
              />
            </div>
            {this.state.torToggling && (
              <div className='tor-loading-bar-container'>
                <div className='tor-loading-bar'></div>
              </div>
            )}
          </form>
          <DownloadPopup openDownloadsPage={this.openDownloadsPage} />
          <button 
            className='tor-status-indicator-controls'
            onClick={this.toggleTor}
            disabled={this.state.torToggling}
            title={
              this.state.torToggling 
                ? (this.state.isTorEnabled ? 'Deactivating Tor...' : 'Activating Tor...') 
                : (this.state.isTorEnabled ? 'Tor Network: Active - Click to Deactivate' : 'Tor Network: Inactive - Click to Activate')
            }
          >
            {this.state.torToggling ? (
              <i className="fas fa-spinner fa-spin" style={{ fontSize: '18px', color: '#00bfff' }} />
            ) : (
              <img 
                src={torIcon} 
                alt={this.state.isTorEnabled ? 'Tor Active' : 'Tor Inactive'}
                className={this.state.isTorEnabled ? 'tor-status-icon tor-active' : 'tor-status-icon tor-inactive'}
              />
            )}
          </button>
          <button
            id='menu'
            title='Options'
            className='p-0 m-0 fas fa-ellipsis-h'
            onClick={() => {
              let newtab = this.state.tabGroup.addTab({
                title: 'Settings',
                src: 'zero://settings',
                icon: 'fas fa-ellipsis-h',
                iconURL: 'icon.png',
                isNative: true,
                comp: Settings,
                compProps: { calledBy: 'menu' }
              })
              newtab.activate()
            }}
          ></button>
        </div>
      </>
    )
  }
}
export default Controls
