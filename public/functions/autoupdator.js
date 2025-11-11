const { autoUpdater } = require('electron-updater')
const preference = require('./config')
const notifier = require('./notifier')
const log = require('electron-log')
const { app } = require('electron')

autoUpdater.logger = log
autoUpdater.logger.transports.file.level = 'info'
/*Disable autodownload of updates if updates are found*/
autoUpdater.autoDownload = false

// Skip auto-update in development mode
if (!app.isPackaged) {
  console.log('Auto-updater disabled in development mode')
  module.exports = autoUpdater
  return
}

/*Autupdate/notify/ignore updates based on user preference*/
let updatePreferene = preference.getPreference('updateMethod').updateMethod
let updateNotificationShown = false
if (updatePreferene == 'auto') {
  autoUpdater.autoDownload = true
  autoUpdater.checkForUpdatesAndNotify().catch(err => {
    console.log('Update check failed:', err.message)
  })
} else if (updatePreferene == 'notify') {
  autoUpdater.checkForUpdates().catch(err => {
    console.log('Update check failed:', err.message)
  })
  autoUpdater.on('update-available', info => {
    if (!updateNotificationShown) {
      updateNotificationShown = true
      notifier.notify(
        'Update available',
        'New version of Zero Browser is available, click here to update in the background.',
        () => {
          notifier.notify(
            'Updating...',
            'We will notify you when update is ready, feel free to use Zero.',
            null
          )
          autoUpdater.autoDownload = true
          autoUpdater.checkForUpdatesAndNotify().catch(err => {
            console.log('Update download failed:', err.message)
          })
        }
      )
    }
  })
}
autoUpdater.on('error', error => {
  console.log('AutoUpdater error:', error.message)
})

module.exports = autoUpdater
