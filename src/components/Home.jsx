import React from 'react'
import '../assets/css/home.css'
import Controls from './partials/Controls'
import TabGroup from '../electron-tabs'
import BlankTab from './nativePages/BlankTab'

class Home extends React.Component {
  constructor (props) {
    super(props)
    this.tabGroup = null
    this.state = {
      tabGroup: null,
      theme: 'dark-theme',
      isFullScreen: false,
      isFirstRender: true,
      /* Get os platform from the main process*/
      platfom: window.preloadAPI.send('getPlatform', '', true)
    }
  }
  componentDidMount () {
    if (this.state.isFirstRender) {
      this.tabGroup = new TabGroup()
      this.setState({ tabGroup: this.tabGroup })
      this.setState({ isFirstRender: false })
    }
    window.preloadAPI.receive('openInNewtab', url => {
      /* If the URI is a pdf, download the pdf as pdf won't be loading in an in memory session */
      if (url.endsWith('.pdf')) {
        window.preloadAPI.send('downloadURL', url, false)
        return
      }
      let tab = this.tabGroup.addTab({
        title: 'Loading...',
        src: url,
        isNative: false
      })
      tab.activate()
    })
  }
  loadStartingPage = () => {
    this.addNewNativeTab()
  }

  addNewNativeTab = (title, src, comp, icon) => {
    let tab = this.tabGroup.addTab({
      title: title || 'Home',
      src: src || '',
      icon: 'fa fa-grip-horizontal' || icon,
      iconURL: 'icon.png',
      isNative: true,
      comp: comp || BlankTab
    })
    tab.activate()
  }
  changeTheme = () => {
    if (this.state.theme === 'dark-theme')
      this.setState({ theme: 'light-theme' })
    else this.setState({ theme: 'dark-theme' })
  }
  changeFullscreen = () => {
    //this.setState({ isFullScreen: true })
  }

  listenerReady = () => {
    this.loadStartingPage()
  }

  render () {
    return (
      <>
        <div className='dark-theme'>
          <div
            className={
              this.state.isFullScreen
                ? 'etabs-tabgroup d-none'
                : 'etabs-tabgroup'
            }
          >
            <div
              className={
                this.state.platfom === 'darwin' ? 'mactrafficlight' : 'd-none'
              }
            ></div>
            <div className='etabs-tabs'></div>
            <div className='etabs-buttons'>
              <button onClick={() => this.addNewNativeTab()}>+</button>
            </div>
            <div
              className={
                this.state.platfom === 'darwin' ? 'd-none' : 'windowactions'
              }
            >
              <button
                className='win-info'
                title='About'
                onClick={() => {
                  // Open about page in new tab
                  let tab = this.state.tabGroup.addTab({
                    title: 'Zero Browser',
                    src: 'https://zer0.build',
                    isNative: false
                  })
                  tab.activate()
                }}
              >
                i
              </button>
              <button
                className='win-min'
                title='Minimize'
                onClick={() => {
                  window.preloadAPI.send('windowAction', 'minimize', false)
                }}
              >
                −
              </button>
              <button
                className='win-max'
                title='Maximize'
                onClick={() => {
                  window.preloadAPI.send('windowAction', 'maxmin', false)
                }}
              >
                ▢
              </button>
              <button
                className='win-close'
                title='Close'
                onClick={() => {
                  window.preloadAPI.send('windowAction', 'close', false)
                }}
              >
                ✕
              </button>
            </div>
          </div>
          <div className='etabs-views'>
            <Controls
              tabGroup={this.state.tabGroup}
              listenerReady={this.listenerReady}
              addNewNativeTab={this.addNewNativeTab}
              changeTheme={this.changeTheme}
              changeFullscreen={this.changeFullscreen}
            />
          </div>
        </div>
      </>
    )
  }
}
export default Home
