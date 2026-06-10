import type { I18nMessageSchema } from '../types'

const en: I18nMessageSchema = {
  // Main window — empty state
  'main.empty.title': 'Welcome to AstrBot Live2D',
  'main.empty.subtitle': 'No model imported yet. Please import a Live2D model first.',
  'main.empty.import': 'Import Model',
  'main.empty.settings': 'Or manage models in Settings',

  // Main window — status toasts
  'main.status.connected': 'Connected to server',
  'main.status.disconnected': 'Disconnected',
  'main.status.suspended': 'System suspended, connection paused',
  'main.status.modelLoaded': 'Model loaded successfully',
  'main.status.modelImportSuccess': 'Model imported successfully',
  'main.status.modelLoadFailed': 'Failed to load model: {message}',
  'main.status.modelImportFailed': 'Failed to import model: {message}',
  'main.status.modelInfoParseFailed': 'Failed to parse model resource',
  'main.status.connectionError': 'Connection error: {message}',

  // Main window — retry
  'main.retry.hint': 'Disconnected, retrying in {seconds}s (attempt {attempt})',
  'main.retry.waiting': 'Disconnected, waiting for auto-retry',

  // Main window — recording
  'main.recording.indicator': 'Recording... {duration}s',
  'main.recording.hintShortcut': 'Press shortcut again to stop',
  'main.recording.hintManual': 'Click microphone button to stop',
  'main.recording.short': 'Recording too short',
  'main.recording.notConnected': 'Not connected to server',
  'main.recording.failed': 'Recording failed: {message}',
  'main.recording.notSupported': 'Your browser does not support recording',
  'main.recording.sendFailed': 'Send failed: {message}',
  'main.recording.stopFailed': 'Failed to stop recording: {message}',
  'main.recording.sending': 'Sending audio...',
  'main.recording.sent': 'Audio sent',
  'main.recording.voiceMessage': '[Voice Message]',

  // Main window — input
  'main.input.placeholder': 'Type a message... (Ctrl+V to paste)',
  'main.input.send': 'Send',
  'main.input.sendImage': 'Send Image',
  'main.input.holdToRecord': 'Hold to record',
  'main.input.clickToRecord': 'Click to record',
  'main.input.clickToStop': 'Click to stop',
  'main.input.sendingFailed': 'Send failed: {message}',
  'main.input.sent': 'Message sent',
  'main.input.imageTooLarge': 'Image size cannot exceed {max}MB',
  'main.input.processingImage': 'Processing image...',
  'main.input.notConnected': 'Not connected to server',

  // Main window — model
  'main.model.folderFailed': 'Failed to select folder: {message}',
  'main.model.multiFileDetected': 'Multiple model files detected, auto-selected: {file}',
  'main.model.compatibilityWarning':
    'Model has compatibility or fallback resource warnings: {warnings}',

  // Main window — platform
  'main.platform.waylandWarning':
    'Linux Wayland session detected: smart passthrough and fullscreen app detection are unavailable.',
  'main.platform.linuxWarning':
    'Linux session detected: smart passthrough is unavailable, auto-update requires manual download.',

  // Main window — misc
  'main.defaultUserName': 'Desktop User',
  'main.imageAlt': 'AstrBot message image',
  'main.performSequence': '[Performance Sequence]',
  'main.serverUser': 'Server',

  // Radial menu
  'menu.history': 'History',
  'menu.settings': 'Settings',
  'menu.talk': 'Chat',
  'menu.resetPosition': 'Reset Position',

  // Settings menu
  'settings.menu.connection': 'Connection',
  'settings.menu.connection.bridge': 'Bridge Connection',
  'settings.menu.connection.connectionBehavior': 'Connection Behavior',
  'settings.menu.connection.workspace': 'Workspace Status',
  'settings.menu.model': 'Model',
  'settings.menu.model.current': 'Current Model',
  'settings.menu.model.library': 'Model Library',
  'settings.menu.history': 'History',
  'settings.menu.history.messages': 'Messages',
  'settings.menu.history.statistics': 'Statistics',
  'settings.menu.advanced': 'Advanced',
  'settings.menu.advanced.behavior': 'Behavior',
  'settings.menu.advanced.shortcut': 'Shortcuts',
  'settings.menu.advanced.windowWatcher': 'Window Watcher',
  'settings.menu.advanced.data': 'Data Management',
  'settings.menu.about': 'About',
  'settings.menu.about.info': 'About',

  'settings.menu.groupLabel.connection': 'Connection',
  'settings.menu.groupLabel.model': 'Model',
  'settings.menu.groupLabel.history': 'History',
  'settings.menu.groupLabel.advanced': 'Advanced',
  'settings.menu.groupLabel.about': 'About',

  'settings.sidebar.collapse': 'Collapse sidebar',
  'settings.sidebar.expand': 'Expand sidebar',
  'settings.sidebar.connected': 'Connected',
  'settings.sidebar.disconnected': 'Disconnected',

  'settings.search.placeholder': 'Search settings',
  'settings.search.noResults': 'No matching settings',

  'settings.quickMenu.title': 'Language & appearance',

  'settings.section.loadFailed': 'Failed to load section',
  'settings.section.retry': 'Retry',

  'settings.page.connection.bridge.desc':
    'Configure WebSocket URL and token for the AstrBot adapter.',
  'settings.page.connection.connectionBehavior.desc':
    'Auto-connect, retry, and handshake timeout behavior.',
  'settings.page.connection.workspace.desc': 'Session, user, and workspace runtime status.',
  'settings.page.model.current.desc': 'Loaded model, behavior, and theme color.',
  'settings.page.model.library.desc': 'Import and manage your local model library.',
  'settings.page.model.library.selectHint': 'Select a model on the left to inspect and act.',
  'settings.model.library.previewLoading': 'Loading preview…',
  'settings.model.library.previewFailed': 'Preview failed to load',
  'settings.model.library.previewSelect': 'Select a model to preview Live2D',
  'settings.page.history.messages.desc': 'Browse and search local message history.',
  'settings.page.history.statistics.desc': 'Message trends and active hours.',
  'settings.page.advanced.behavior.desc':
    'Desktop interaction, recording, bubbles, and screenshots.',
  'settings.page.advanced.shortcut.desc': 'Global recording shortcut and duration limit.',
  'settings.page.advanced.windowWatcher.desc': 'Window focus and app switch monitoring.',
  'settings.page.advanced.data.desc': 'Logs, cache, config import/export, and reset.',
  'settings.page.about.info.desc': 'Version, language, appearance, and links.',

  'settings.connection.bridge.asideTitle': 'Notes',
  'settings.connection.bridge.copyUrl': 'Copy server URL',
  'settings.connection.bridge.copyUrlSuccess': 'Copied to clipboard',
  'settings.connection.bridge.copyUrlFailed': 'Copy failed',

  'settings.appearance.colorScheme': 'Appearance',
  'settings.appearance.colorScheme.light': 'Light',
  'settings.appearance.colorScheme.dark': 'Dark',
  'settings.appearance.colorScheme.system': 'System',

  'settings.about.heroSubtitle': 'Desktop Live2D client · Built for the AstrBot ecosystem',
  'settings.about.protocolVersion': 'Protocol {version}',

  // Settings titlebar
  'settings.titlebar.title': 'Settings',
  'settings.titlebar.minimize': 'Minimize',
  'settings.titlebar.maximize': 'Maximize',
  'settings.titlebar.restore': 'Restore',
  'settings.titlebar.close': 'Close',
  'settings.titlebar.pin': 'Pin window',
  'settings.titlebar.unpin': 'Unpin window',

  // Welcome window
  'welcome.greeting': "Nice to meet you, let's be friends~",
  'welcome.subtitle': "I'll be your personal desktop companion, always by your side...",
  'welcome.formTitle': 'What should I call you?',
  'welcome.formHint': 'Tell me your nickname, and let the journey begin ✦',
  'welcome.placeholder': 'Enter your nickname...',
  'welcome.submit': "Let's get started",
  'welcome.submitting': 'Preparing your cozy space...',
  'welcome.error': 'Oops, setup failed. Please try again later~',
  'welcome.enterHint': 'Press Enter to continue',
  'welcome.close': 'Close',

  // Media player
  'media.close': 'Close',
  'media.imageAlt': 'Performance image',
  'media.clickToClose': 'Click empty area to close',
  'media.audioLoadFailed': 'Audio resource failed to load',
  'media.audioLoadAborted': 'Audio resource loading aborted',
  'media.audioLoadTimeout': 'Audio resource loading timed out ({ms}ms)',
  'media.audioUrlInvalid': 'Audio resource URL is not available',

  // Expression types
  'expression.group.basic': 'Basic',
  'expression.group.emotion': 'Emotion',
  'expression.group.state': 'State',
  'expression.group.effect': 'Effect',
  'expression.neutral': 'Neutral',
  'expression.happy': 'Happy',
  'expression.sad': 'Sad',
  'expression.angry': 'Angry',
  'expression.surprised': 'Surprised',
  'expression.thinking': 'Thinking/Confused',
  'expression.tired': 'Tired/Sleepy',
  'expression.disgusted': 'Disgusted',
  'expression.playful': 'Playful',
  'expression.special': 'Special Effect',
  'expression.anxious': 'Nervous/Fearful',
  'expression.blush': 'Blushing/Shy',
  'expression.sweat': 'Sweating',
  'expression.speaking': 'Speaking',

  // Bridge validation
  'validation.urlRequired': 'Server address is required',
  'validation.urlInvalid':
    'Invalid server address format, please enter a complete WebSocket address',
  'validation.urlProtocol': 'Server address must use ws or wss protocol',
  'validation.tokenRequired':
    'Auth token is required, please fill in the settings before connecting',

  // Toasts — Connection
  'toast.connectionSaved': 'Connection configuration saved',
  'toast.connectionSaveFailed': 'Save failed: {error}',
  'toast.connectRequested': 'Connection request submitted',
  'toast.connectFailed': 'Connection failed: {error}',
  'toast.disconnected': 'Disconnected',
  'toast.disconnectFailed': 'Disconnect failed: {error}',
  'toast.connectionConfigStale':
    'Connection config was updated by another window, synced automatically',

  // Toasts — Model
  'toast.modelImported': 'Model imported successfully',
  'toast.modelDeleted': 'Model deleted',
  'toast.modelLoadSent': 'Model load command sent, check main window for result',
  'toast.modelReloadSent': 'Model deleted, current model reloaded',
  'toast.modelDeleteFailed': 'Delete failed: {error}',
  'toast.modelListFailed': 'Failed to load model list',
  'toast.modelExpressionReadFailed': 'Failed to read expression types',

  // Toasts — Expression
  'toast.expressionSaved': 'Expression types saved, reloading current model',
  'toast.expressionSaveFailed': 'Failed to save expression types: {error}',

  // Toasts — Shortcut
  'toast.shortcutRegistered': 'Shortcut registered successfully',
  'toast.shortcutRegisterFailed': 'Registration failed: {error}',
  'toast.shortcutCleared': 'Shortcut cleared',
  'toast.shortcutNotSet': 'Please set a shortcut first',

  // Toasts — Watcher
  'toast.watcherConfigSaved': 'Window watcher configuration saved',
  'toast.watcherConfigSaveFailed': 'Save failed: {error}',
  'toast.watcherConfigReset': 'Window watcher configuration reset',
  'toast.watcherConfigResetFailed': 'Reset failed: {error}',

  // Toasts — History
  'toast.historyCleared': 'History cleared',
  'toast.historyClearFailed': 'Clear failed: {error}',
  'toast.historyLoadedFailed': 'Failed to load history',
  'toast.historyStatsFailed': 'Failed to load statistics',
  'toast.fileResourceUnavailable': 'File resource unavailable',
  'toast.fileOpenFailed': 'Failed to open file: {error}',
  'toast.fileDownloadFailed': 'Failed to download file: {error}',
  'toast.fileSaved': 'File save started',
  'toast.historyRefreshed': 'Refreshed',

  // Toasts — Maintenance
  'toast.logDirOpened': 'Log directory opened: {path}',
  'toast.logDirOpenFailed': 'Failed to open log directory: {error}',
  'toast.logExported': 'Exported {count} log file(s): {path}',
  'toast.logExportFailed': 'Failed to export logs: {error}',
  'toast.cacheCleared': 'Cache cleared',
  'toast.settingsReset': 'Settings reset',
  'toast.settingsResetFailed': 'Reset failed: {error}',
  'toast.cubismCoreDownloadSuccess': 'Live2D SDK downloaded successfully',
  'toast.cubismCoreDownloadFailed': 'Live2D SDK download failed: {error}',
  'toast.cubismCoreAlreadyExists': 'Live2D SDK already exists',

  // Toasts — About/Update
  'toast.aboutSaveFailed': 'Save failed: {error}',
  'toast.updateCheckFailed': 'Update check failed: {error}',
  'toast.updateInstallFailed': 'Failed to install update: {error}',

  // Dialogs — generic
  'dialog.confirm': 'OK',
  'dialog.cancel': 'Cancel',
  'dialog.retry': 'Retry',

  // Settings — About
  'settings.about.title': 'About',
  'settings.about.appName': 'App Name',
  'settings.about.version': 'Version',
  'settings.about.updateStatus': 'Update Status',
  'settings.about.autoCheckUpdate': 'Auto-check for updates',
  'settings.about.author': 'Author',
  'settings.about.language': 'Language',
  'settings.about.specialThanks': 'Special Thanks',
  'settings.about.sponsorDesc':
    'Provided substantial AI Token support for this project, accelerating development',
  'settings.about.relatedProjects': 'Related Projects',
  'settings.about.projectRepo': 'Project Repository',
  'settings.about.adapterPlugin': 'Platform Adapter Plugin',
  'settings.about.enabled': 'Enabled',
  'settings.about.disabled': 'Disabled',
  'settings.about.autoCheckDesc':
    'When enabled, the app will automatically check for updates on startup. When disabled, updates will not be checked at startup but can still be checked manually.',
  'settings.about.checkUpdate': 'Check for Updates',
  'settings.about.restartAndInstall': 'Restart and Install',
  'settings.about.poweredBy': 'Powered by Live2D',

  // Settings — About (extra)
  'settings.about.updateStatusUnknown': 'Update status unknown',

  // Settings — Connection bridge
  'settings.connection.bridge.serverUrl': 'Server Address',
  'settings.connection.bridge.token': 'Auth Token',
  'settings.connection.bridge.tokenPlaceholder': 'Required, must match AstrBot adapter auth_token',
  'settings.connection.bridge.saveConfig': 'Save Connection Config',
  'settings.connection.bridge.saveAndConnect': 'Save and Connect',
  'settings.connection.bridge.connect': 'Connect to Server',
  'settings.connection.bridge.connected': 'Connected',
  'settings.connection.bridge.disconnect': 'Disconnect',
  'settings.connection.bridge.resourceService': 'Resource Service',
  'settings.connection.bridge.resourceServerUrl': 'Resource Server URL',
  'settings.connection.bridge.resourceServerUrlPlaceholder':
    'Auto-follows connection address when empty',
  'settings.connection.bridge.resourcePath': 'Resource Path',
  'settings.connection.bridge.resourcePathPlaceholder': 'Defaults to handshake path or /resources',
  'settings.connection.bridge.resourceToken': 'Resource Access Token',
  'settings.connection.bridge.resourceTokenPlaceholder': 'Reuses WebSocket auth token when empty',

  // Settings — Connection behavior
  'settings.connection.behavior.title': 'Connection Behavior',
  'settings.connection.behavior.autoConnectOnAppLaunch': 'Auto-connect on App Launch',
  'settings.connection.behavior.autoConnectOnAppLaunchDesc':
    'Automatically connect to the server when the app starts. Requires manual connection when disabled.',
  'settings.connection.behavior.resumeDesiredConnectionOnWake': 'Resume Connection on Wake',
  'settings.connection.behavior.resumeDesiredConnectionOnWakeDesc':
    'Automatically resume the previous connection state after system wakes from sleep.',
  'settings.connection.behavior.retryEnabled': 'Enable Auto-retry',
  'settings.connection.behavior.retryEnabledDesc':
    'Automatically retry connection with exponential backoff strategy after failure or disconnect.',
  'settings.connection.behavior.retryBaseDelayMs': 'Base Retry Delay',
  'settings.connection.behavior.retryBaseDelayMsDesc':
    'Initial retry delay. Subsequent retries will gradually increase (exponential backoff).',
  'settings.connection.behavior.retryMaxDelayMs': 'Max Retry Delay',
  'settings.connection.behavior.retryMaxDelayMsDesc':
    'Upper limit for retry delay to prevent infinite growth.',
  'settings.connection.behavior.retryMaxAttempts': 'Max Retry Attempts',
  'settings.connection.behavior.retryMaxAttemptsDesc':
    'Stop retrying after reaching this number. Set to "Unlimited" to retry indefinitely until success or manual stop.',
  'settings.connection.behavior.handshakeTimeoutMs': 'Handshake Timeout',
  'settings.connection.behavior.handshakeTimeoutMsDesc':
    'Maximum time to wait for handshake completion after WebSocket connection is established.',
  'settings.connection.behavior.unlimited': 'Unlimited',
  'settings.connection.behavior.limited': 'Limited',
  'settings.connection.behavior.reset': 'Reset',
  'settings.connection.behavior.save': 'Save Connection Behavior',
  'settings.connection.behavior.cancel': 'Cancel Changes',
  'settings.connection.behavior.saveSuccess': 'Connection behavior settings saved',
  'settings.connection.behavior.saveFailed': 'Save failed: {error}',

  // Settings — Connection status
  'settings.connection.status.connecting': 'Connecting',
  'settings.connection.status.handshaking': 'Handshaking',
  'settings.connection.status.online': 'Online',
  'settings.connection.status.waitingRetry': 'Waiting retry (attempt {attempt})',
  'settings.connection.status.waiting': 'Waiting retry',
  'settings.connection.status.suspended': 'System suspended',
  'settings.connection.status.connectionFailed': 'Connection failed',
  'settings.connection.status.offline': 'Offline',

  // Settings — Connection workspace
  'settings.connection.workspace.connectionStatus': 'Connection status',
  'settings.connection.workspace.desiredState': 'Desired state',
  'settings.connection.workspace.keepConnected': 'Keep connected',
  'settings.connection.workspace.keepDisconnected': 'Keep disconnected',
  'settings.connection.workspace.userId': 'User ID',
  'settings.connection.workspace.notAssigned': 'Not assigned',
  'settings.connection.workspace.sessionId': 'Session ID',
  'settings.connection.workspace.notEstablished': 'Not established',
  'settings.connection.workspace.resourceBaseUrl': 'Resource URL',
  'settings.connection.workspace.autoFollow': 'Auto-follow',
  'settings.connection.workspace.resourcePath': 'Resource path',

  // Settings — Connection misc
  'settings.connection.initFailed': 'Connection configuration initialization failed',
  'settings.connection.settingsStaleWarning':
    'Connection configuration has been updated by another window. Please save or discard current changes before syncing.',
  'settings.connection.resetFailed': 'Connection configuration reset failed: {error}',

  // Settings — Model
  'settings.model.status.inUse': 'In use',
  'settings.model.status.notLoaded': 'Not loaded',
  'settings.model.currentModel': 'Current model',
  'settings.model.noModelLoaded': 'No model loaded',
  'settings.model.notLoadedWarn': 'No model currently loaded',
  'settings.model.expressionReloadFailed':
    'Expression types saved, but model reload failed: {error}',

  // Settings — Advanced / Platform
  'settings.advanced.platform.unknown': 'Unknown',
  'settings.advanced.platform.gameModeUnavailable': 'Unavailable ({reason})',
  'settings.advanced.platform.gameModeNative': 'Available (native window manager)',
  'settings.advanced.platform.gameModeHeuristic': 'Available (active window heuristic)',
  'settings.advanced.platform.passThroughSupported': 'Supported',
  'settings.advanced.platform.passThroughUnsupported':
    'Unsupported (current platform cannot forward mouse events stably)',
  'settings.advanced.platform.waylandNotice':
    'Wayland session: smart passthrough and auto-detect fullscreen are unavailable. Use an X11 environment for a better experience.',
  'settings.advanced.platform.linuxNotice':
    'Linux session: smart passthrough is unavailable, auto-update requires manual download from Releases.',
  'settings.advanced.platform.win32GameModeDisabled':
    'Auto-detection of fullscreen applications is disabled on this Windows platform: {reason}',

  // Settings — History
  'settings.history.direction.outgoing': 'Sent',
  'settings.history.direction.incoming': 'Received',
  'settings.history.clearTitle': 'Clear History',
  'settings.history.clearContent':
    'Are you sure you want to clear all history? This action cannot be undone!',

  // Settings — Maintenance
  'settings.maintenance.clearCacheTitle': 'Clear Cache',
  'settings.maintenance.clearCacheContent': 'Are you sure you want to clear all cached data?',
  'settings.maintenance.resetSettingsTitle': 'Reset Settings',
  'settings.maintenance.resetSettingsContent':
    'Are you sure you want to reset all settings? This action cannot be undone!',

  // Tray
  'tray.showMain': 'Show Main Window',
  'tray.settings': 'Settings',
  'tray.history': 'History',
  'tray.quit': 'Quit',
  'tray.status.connected': 'Connected',
  'tray.status.connecting': 'Connecting...',
  'tray.status.handshaking': 'Handshaking...',
  'tray.status.waiting': 'Waiting to reconnect',
  'tray.status.retrying': 'Reconnecting...{seconds}s (attempt {attempt})',
  'tray.status.suspended': 'Suspended',
  'tray.status.error': 'Connection error',
  'tray.status.offline': 'Offline',

  // Updater status
  'updater.notChecked': 'Not checked for updates',
  'updater.checking': 'Checking for updates...',
  'updater.manualChecking': 'Manually checking for updates...',
  'updater.alreadyChecking': 'Update check in progress, please wait',
  'updater.autoUpdateEnabled': 'Auto-update enabled',
  'updater.autoCheckDisabled': 'Auto-check disabled, you can still check manually',
  'updater.upToDate': 'Already up to date',
  'updater.newVersionFound': 'New version {version} found, downloading...',
  'updater.newVersionManual': 'New version {version} found, available for manual download',
  'updater.downloading': 'Downloading update: {percent}%',
  'updater.downloadedWaitReplace': 'New version {version} downloaded, waiting to replace',
  'updater.downloadedWaitInstall': 'New version {version} downloaded, waiting to install',
  'updater.downloadComplete': 'New version {version} downloaded',
  'updater.error': 'Auto-update error: {message}',
  'updater.checkFailed': 'Update check failed: {message}',

  // Updater dialog
  'updater.dialog.newVersionTitle': 'New Version Found',
  'updater.dialog.updateFailedTitle': 'Update Failed',
  'updater.dialog.installPromptPortable': 'Close the app and replace the portable update now?',
  'updater.dialog.installPromptRegular': 'Restart and install the update now?',
  'updater.dialog.installNowPortable': 'Replace Now',
  'updater.dialog.installNowRegular': 'Install Now',
  'updater.dialog.later': 'Later',
  'updater.checkInitiated': 'Update check initiated',
  'updater.noInstalledDownload': 'No downloaded update available to install',
  'updater.restartInstall': 'Restarting to install update',
  'updater.closingReplace': 'Closing app to replace portable update',
  'updater.portableReplaceFailed': 'Failed to start portable update: {message}',

  // Updater disabled reasons
  'updater.disabled.dev': 'Auto-update disabled in dev environment',
  'updater.disabled.platform': 'Auto-update not supported on this platform',
  'updater.disabled.noConfig': 'Missing auto-update config file (app-update.yml)',
  'updater.disabled.generic': 'Auto-update unavailable',

  // Updater portable errors
  'updater.portable.exeNotFound': 'Current portable executable path not found',
  'updater.portable.downloadNotFound': 'Downloaded portable update file not found',
  'updater.portable.exeNotExist': 'Current portable executable does not exist, cannot replace',
  'updater.portable.pathAbnormal':
    'Downloaded update file path is abnormal, cannot perform portable replacement',

  // Cubism download dialogs
  'cubism.download.title': 'Live2D SDK Download',
  'cubism.download.message': 'First launch requires downloading Live2D Cubism SDK',
  'cubism.download.detail':
    'The app needs to download Live2D Cubism Core to run properly.\n\nBaseline: {baseline}\nSource: {url}\n\nClick "OK" to start download (~200KB).',
  'cubism.download.successTitle': 'Download Complete',
  'cubism.download.successMessage': 'Live2D SDK download successful',
  'cubism.download.successDetail': 'The app will continue to launch.',
  'cubism.download.failedTitle': 'Download Failed',
  'cubism.download.failedMessage': 'Live2D SDK download failed',
  'cubism.download.failedDetail':
    'Error: {error}\n\nPlease check your network connection and try again.',
  'cubism.download.retryDetail':
    'Error: {error}\n\nAttempt {attempt}/{max} failed. Would you like to retry?',

  // Main process error dialogs
  'mainProcess.databaseInitFailed': 'Database Initialization Failed',
  'mainProcess.databaseInitFailedDetail':
    'Failed to create or open database file. The app will exit.\n\nError details: {error}',
  'mainProcess.initFailed': 'Initialization Failed',
  'mainProcess.initFailedDetail':
    'An error occurred during app initialization. The app will exit.\n\n{error}',

  // Settings — Advanced shortcut
  'settings.advanced.shortcut.recordingShortcut': 'Global Recording Shortcut',
  'settings.advanced.shortcut.pressKeys': 'Press keys...',
  'settings.advanced.shortcut.clear': 'Clear',
  'settings.advanced.shortcut.register': 'Register',
  'settings.advanced.shortcut.registered': 'Registered',
  'settings.advanced.shortcut.maxDuration': 'Max Recording Duration',
  'settings.advanced.shortcut.maxDurationHint': 'seconds (max 60s)',

  // Shortcut
  'shortcut.occupiedOrInvalid': 'Shortcut is occupied or invalid',

  // Settings — Connection workspace
  'settings.connection.workspace.description': 'Current connection and session status information.',
  'settings.connection.workspace.currentModel': 'Current Model',
  'settings.connection.workspace.sourceColor': 'Theme Color',

  // Settings — Model current
  'settings.model.current.description':
    'View the currently loaded Live2D model information and confirm whether the theme color comes from the model palette.',
  'settings.model.current.notLoaded': 'No model loaded',
  'settings.model.current.behavior': 'Model Behavior',
  'settings.model.current.behaviorDesc':
    'While idle the model drifts subtly via a built-in procedural animation; motions and expressions are triggered by AstrBot perform commands. Settings are saved per model and applied immediately.',
  'settings.model.current.idleActivity': 'Idle activity',
  'settings.model.current.idleActivityFeedback':
    'Directly scales the idle sway amplitude (0.4x–4x): higher means larger, more visible movement; lower keeps the model calmer. Breathing always stays on.',
  'settings.model.current.persistentExpressions': 'Persistent expressions',
  'settings.model.current.persistentExpressionsPlaceholder': 'Select expressions to keep active',
  'settings.model.current.persistentExpressionsFeedback':
    'Parameters of the selected expressions stay applied (e.g. watermark or outfit toggles) and are not overridden by performances.',
  'settings.model.current.expressions': 'Expression Types',
  'settings.model.current.saveExpression': 'Save Assignment',
  'settings.model.current.expressionDesc':
    'Assign exp3 expressions from the current model to fixed expression types. Multiple expressions can be assigned per type and one will be selected randomly during execution.',
  'settings.model.current.expressionProfilePath': 'Configuration saved with model: {path}',
  'settings.model.current.unassigned': 'Unassigned',
  'settings.model.current.noExpressions': 'Current model has no assignable exp3 expressions',
  'settings.model.current.preferences': 'Model Preferences',
  'settings.model.current.preferencesDesc':
    'Configure theme color following strategy. Changes take effect immediately.',
  'settings.model.current.scale': 'Current Model Scale',
  'settings.model.current.resetScale': 'Reset',
  'settings.model.current.themeFollowModel': 'Theme follows current model',
  'settings.model.current.themeFollowFeedback':
    'When enabled, the interface theme will follow the current model color scheme; when disabled, manual or existing theme settings will be preserved.',
  'settings.model.current.currentThemeColor': 'Current Theme Color',
  'settings.model.current.pickColor': 'Pick color',
  'settings.model.current.resetAutoColor': 'Restore auto extraction',
  'settings.model.current.syncStatus': 'Sync Status',
  'settings.model.current.followingModel': 'Following current model',
  'settings.model.current.waitingForModel': 'Waiting for model to load',
  'settings.model.current.syncDisabled': 'Auto-sync disabled',

  // Settings — Model library
  'settings.model.library.importModel': 'Import Model',
  'settings.model.library.description':
    'Manage local Live2D model files. {count} model(s) in total.',
  'settings.model.library.modelCount': '{count} model(s)',
  'settings.model.library.current': 'Current',
  'settings.model.library.reload': 'Reload',
  'settings.model.library.load': 'Load',
  'settings.model.library.delete': 'Delete',
  'settings.model.library.empty': 'No models yet, please import one first',

  // Settings — Advanced behavior
  'settings.advanced.behavior.description':
    'Configure app startup behavior, notification strategy, and log level. Changes take effect immediately.',
  'settings.advanced.behavior.autoConnect': 'Auto-connect on launch',
  'settings.advanced.behavior.resumeOnWake': 'Auto-resume connection after system wake',
  'settings.advanced.behavior.retryEnabled': 'Enable auto-retry',
  'settings.advanced.behavior.retryBaseDelay': 'Retry base delay',
  'settings.advanced.behavior.retryMaxDelay': 'Retry max delay',
  'settings.advanced.behavior.retryMaxAttempts': 'Max retry attempts',
  'settings.advanced.behavior.retryUnlimited': 'Leave empty for unlimited',
  'settings.advanced.behavior.handshakeTimeout': 'Handshake timeout',
  'settings.advanced.behavior.recordingMode': 'Recording mode',
  'settings.advanced.behavior.recordingModeHold': 'Hold to talk',
  'settings.advanced.behavior.recordingModeToggle': 'Click to toggle',
  'settings.advanced.behavior.recordingModeFeedback':
    'Hold to talk: press and hold to record, release to stop. Click to toggle: click once to start, click again to stop.',
  'settings.advanced.behavior.autoLoadLastModel': 'Auto-load last model on launch',
  'settings.advanced.behavior.silenceDetection': 'Enable silence detection during recording',
  'settings.advanced.behavior.silenceDetectionFeedback':
    'Automatically stop recording when no sound is detected for a period, reducing silent audio segments.',
  'settings.advanced.behavior.baseEventNotifications': 'Basic event notification toasts',
  'settings.advanced.behavior.logLevel': 'Log level',
  'settings.advanced.behavior.bubbleStackMax': 'Max bubble count',
  'settings.advanced.behavior.bubbleFollowUpWindow': 'Bubble follow-up window',
  'settings.advanced.behavior.imageInlineThreshold': 'Image inline threshold',
  'settings.advanced.behavior.imageMaxSize': 'Image max size',
  'settings.advanced.behavior.screenshotTarget': 'Screenshot default target',
  'settings.advanced.behavior.screenshotActiveWindow': 'Active window',
  'settings.advanced.behavior.screenshotDesktop': 'Entire desktop',
  'settings.advanced.behavior.screenshotQuality': 'Screenshot quality',
  'settings.advanced.behavior.screenshotMaxWidth': 'Screenshot max width',
  'settings.advanced.behavior.desktopInteraction': 'Desktop Interaction',
  'settings.advanced.behavior.desktopInteractionDesc':
    'Control desktop window always-on-top, mouse passthrough, and fullscreen app detection behavior. Changes are saved and take effect immediately.',
  'settings.advanced.behavior.alwaysOnTop': 'Always on top',
  'settings.advanced.behavior.alwaysOnTopFeedback':
    'Keep the desktop character window above normal applications, suitable for scenarios requiring continuous character display.',
  'settings.advanced.behavior.passThroughMode': 'Mouse pass-through',
  'settings.advanced.behavior.passThroughNone': 'No pass-through',
  'settings.advanced.behavior.passThroughDynamic': 'Smart pass-through',
  'settings.advanced.behavior.passThroughFull': 'Full pass-through',
  'settings.advanced.behavior.passThroughNoneFeedback':
    'Mouse events respond normally in the model area without passing through to underlying apps.',
  'settings.advanced.behavior.passThroughDynamicFeedback':
    'Clickable only when hovering over the model or interactive controls; other areas pass through.',
  'settings.advanced.behavior.passThroughFullFeedback':
    'The main window ignores all mouse events, only operable via shortcuts and tray menu.',
  'settings.advanced.behavior.autoDetectFullscreen': 'Auto-detect fullscreen apps',
  'settings.advanced.behavior.autoDetectFullscreenFeedback':
    'When a game or other fullscreen application is detected, automatically adjust window behavior with desktop mode; this option is disabled when unsupported by the current platform.',
  'settings.advanced.behavior.platformCapabilities': 'Platform Capabilities',
  'settings.advanced.behavior.platformCapabilitiesDesc':
    'Features supported by the current system platform.',
  'settings.advanced.behavior.currentPlatform': 'Current platform',
  'settings.advanced.behavior.gameModeLabel': 'Auto-detect fullscreen apps',
  'settings.advanced.behavior.passThroughLabel': 'Smart passthrough support',
  'settings.advanced.behavior.alwaysOnTopLevelLabel': 'Always-on-top level strategy',

  // Units
  'settings.advanced.behavior.milliseconds': 'ms',
  'settings.advanced.behavior.times': 'times',
  'settings.advanced.behavior.bubbles': 'bubbles',
  'settings.advanced.behavior.kb': 'KB',
  'settings.advanced.behavior.mb': 'MB',
  'settings.advanced.behavior.percent': '%',
  'settings.advanced.behavior.pixels': 'px',

  // Settings — Advanced data
  'settings.advanced.data.description': 'Manage app cache, logs, and settings data.',
  'settings.advanced.data.openLogs': 'Open Logs Directory',
  'settings.advanced.data.exportLogs': 'Export Recent Logs',
  'settings.advanced.data.clearCache': 'Clear Cache',
  'settings.advanced.data.resetSettings': 'Reset All Settings',
  'settings.advanced.data.downloadCubismCore': 'Download Live2D SDK',
  'settings.advanced.data.exportConfig': 'Export Config',
  'settings.advanced.data.importConfig': 'Import Config',
  'settings.advanced.data.exportConfigSuccess': 'Config exported to: {path}',
  'settings.advanced.data.exportConfigFailed': 'Export failed: {error}',
  'settings.advanced.data.importConfigTitle': 'Confirm Import Config',
  'settings.advanced.data.importConfigPreview':
    'Exported at: {exportedAt}\nConnection settings: {connectionSettings}\nConnection behavior: {behaviorSettings}\nUser config: {userConfigCount} items\nUI settings: {localStorageCount} items\n\nThis will overwrite existing config. Continue?',
  'settings.advanced.data.importConfigSuccess': 'Config imported successfully',
  'settings.advanced.data.importConfigFailed': 'Import failed: {error}',
  'settings.advanced.data.restartRequired': 'Restart Recommended',
  'settings.advanced.data.restartRequiredDesc':
    'Config imported successfully. Restart the app to ensure all changes take effect.',
  'settings.advanced.data.storageTitle': 'Local storage overview',
  'settings.advanced.data.actionsTitle': 'Maintenance',
  'settings.advanced.data.refreshStorage': 'Refresh stats',
  'settings.advanced.data.storageLoadFailed': 'Failed to load storage stats: {error}',
  'settings.advanced.data.appDataPath': 'Data directory',
  'settings.advanced.data.storageMode.development': 'Development',
  'settings.advanced.data.storageMode.installed': 'Installed',
  'settings.advanced.data.storageMode.portable': 'Portable',
  'settings.advanced.data.metricDatabaseFile': 'Database file',
  'settings.advanced.data.metricDatabaseVersion': 'Schema v{version}',
  'settings.advanced.data.metricResourceBlob': 'Embedded message media',
  'settings.advanced.data.metricResourceCount': '{count} files',
  'settings.advanced.data.metricModelsDir': 'Model library',
  'settings.advanced.data.metricModelCount': '{count} models',
  'settings.advanced.data.metricLogs': 'Log files',
  'settings.advanced.data.metricLogFiles': '{count} files',
  'settings.advanced.data.metricCubismCore': 'Live2D Core',
  'settings.advanced.data.cubismNotInstalled': 'Not installed',
  'settings.advanced.data.metricSessions': 'Sessions',
  'settings.advanced.data.metricMessageRows': '{count} message rows',
  'settings.advanced.data.metricPerformances': 'Performances',
  'settings.advanced.data.metricPerformancesInterrupted': '{count} interrupted',
  'settings.advanced.data.metricResourceDedup': 'Media fingerprints',
  'settings.advanced.data.resourceBreakdownTitle': 'Embedded media by type',
  'settings.advanced.data.dataSpan': 'Message time span',

  // Common
  'common.yes': 'Yes',
  'common.no': 'No',

  // Settings — Advanced watcher
  'settings.advanced.watcher.unsaved': 'Unsaved',
  'settings.advanced.watcher.synced': 'Synced',
  'settings.advanced.watcher.discardChanges': 'Discard Changes',
  'settings.advanced.watcher.saveChanges': 'Save Changes',
  'settings.advanced.watcher.resetDefault': 'Reset to Default',
  'settings.advanced.watcher.basicSwitches': 'Basic Switches',
  'settings.advanced.watcher.basicSwitchesDesc':
    'Monitor window changes to let AI proactively perceive your actions. Changes here remain as local drafts until saved.',
  'settings.advanced.watcher.enableWatcher': 'Enable window watcher',
  'settings.advanced.watcher.enableAppLaunch': 'Enable app launch detection',
  'settings.advanced.watcher.appLaunchFeedback':
    'When disabled, new app launches will no longer trigger proactive desktop events, but other watcher configurations are preserved.',
  'settings.advanced.watcher.monitorFrequency': 'Monitoring Frequency',
  'settings.advanced.watcher.monitorFrequencyDesc':
    'Adjust event trigger rate limiting to prevent AI from responding too frequently.',
  'settings.advanced.watcher.globalInterval': 'Global rate limit (ms)',
  'settings.advanced.watcher.globalIntervalFeedback':
    'Minimum interval between any two events. Default: 1000ms (1 second).',
  'settings.advanced.watcher.perWindowInterval': 'Per-window rate limit (ms)',
  'settings.advanced.watcher.perWindowIntervalFeedback':
    'Minimum interval between two events from the same window. Default: 3000ms (3 seconds).',
  'settings.advanced.watcher.minInterval': 'Minimum interval (ms)',
  'settings.advanced.watcher.minIntervalFeedback':
    'Prevents excessively frequent triggers. Default: 100ms.',
  'settings.advanced.watcher.globalIntervalPlaceholder': 'Default 1000ms',
  'settings.advanced.watcher.perWindowIntervalPlaceholder': 'Default 3000ms',
  'settings.advanced.watcher.minIntervalPlaceholder': 'Default 100ms',
  'settings.advanced.watcher.monitorEvents': 'Monitor Events',
  'settings.advanced.watcher.monitorEventsDesc': 'Select the window change types to monitor.',
  'settings.advanced.watcher.eventFocus': 'Window focus (app open/switch)',
  'settings.advanced.watcher.eventBlur': 'Window blur',
  'settings.advanced.watcher.eventCreate': 'Window create',
  'settings.advanced.watcher.eventDestroy': 'Window close',
  'settings.advanced.watcher.eventFullscreen': 'Window enter fullscreen',
  'settings.advanced.watcher.eventWindowed': 'Window exit fullscreen',
  'settings.advanced.watcher.eventResize': 'Window resize',
  'settings.advanced.watcher.eventMove': 'Window move',
  'settings.advanced.watcher.eventMinimize': 'Window minimize',
  'settings.advanced.watcher.eventMaximize': 'Window maximize',
  'settings.advanced.watcher.eventRestore': 'Window restore',
  'settings.advanced.watcher.aiResponseMode': 'AI Response Mode',
  'settings.advanced.watcher.aiResponseModeDesc': 'Choose how AI responds to window events.',
  'settings.advanced.watcher.aiModeFirstOpen': 'Respond only on first app open',
  'settings.advanced.watcher.aiModeEverySwitch': 'Respond on every app switch',
  'settings.advanced.watcher.aiModeSpecificApps': 'Respond only for specific apps',
  'settings.advanced.watcher.specificAppsList': 'Specific app list (one process name per line)',
  'settings.advanced.watcher.ignoreRules': 'Ignore Rules',
  'settings.advanced.watcher.ignoreRulesDesc':
    'Configure additional processes and windows to ignore. System-critical processes are already built-in; rules added here merge with built-in rules.',
  'settings.advanced.watcher.builtinRules': 'Built-in ignore rules (always active)',
  'settings.advanced.watcher.builtinRulesContent':
    'Processes: dwm.exe, csrss.exe, explorer.exe, SearchUI.exe and other system processes\nTitles: Program Manager, Lock Screen, Task Switching and other system windows',
  'settings.advanced.watcher.ignoreProcessNames': 'Additional ignored process names (one per line)',
  'settings.advanced.watcher.ignoreProcessNamesPlaceholder':
    'Enter additional process names to ignore...',
  'settings.advanced.watcher.ignoreProcessNamesFeedback':
    'These process names merge with built-in rules to filter out processes that should not trigger AI responses.',
  'settings.advanced.watcher.ignoreTitleKeywords':
    'Additional ignored window title keywords (one per line)',
  'settings.advanced.watcher.ignoreTitleKeywordsPlaceholder':
    'Enter additional title keywords to ignore...',
  'settings.advanced.watcher.ignoreTitleKeywordsFeedback':
    'Windows with titles containing these keywords will be ignored.',

  // Settings — History messages
  'settings.history.messages.searchPlaceholder': 'Search messages...',
  'settings.history.messages.direction': 'Direction',
  'settings.history.messages.clear': 'Clear',
  'settings.history.messages.refresh': 'Refresh',
  'settings.history.messages.total': '{count} message(s) in total',
  'settings.history.messages.me': 'Me',
  'settings.history.messages.unknownSource': 'Unknown source',

  // Settings — History statistics
  'settings.history.statistics.description': 'Message trends and content distribution statistics.',
  'settings.history.statistics.messageTrend': 'Message Trends',
  'settings.history.statistics.contentDistribution': 'Content Distribution',
  'settings.history.statistics.activeHours': 'Active Hours',
  'settings.history.statistics.messageCount': 'Messages',
  'settings.history.statistics.usageCount': 'Usage',
  'settings.history.statistics.text': 'Text',
  'settings.history.statistics.image': 'Images',
  'settings.history.statistics.audio': 'Audio',
  'settings.history.statistics.video': 'Video',

  // Common error fallbacks
  'error.unknown': 'Unknown error',
  'error.platformNotSupported': 'Current platform not supported',
  'error.capabilityUnavailable': 'Capability unavailable',
  'error.resourceIdEmpty': 'Resource identifier cannot be empty',
  'error.resourceIdIllegalPath': 'Resource identifier contains illegal path segments',
  'error.resourceRequestFailed': 'Resource request failed ({status})',
  'error.resourceNotResolvable': 'Message resource cannot be resolved to downloadable URL: {name}',
  'error.resourceMixedWrite':
    'Message contains both localized and unlocalized resources, rejecting mixed write',
  'error.databaseNotInitialized': 'Database not initialized',
  'error.notConnectedToServer': 'Not connected to server',
  'error.connectionSuperseded': 'Connection request superseded by a newer lifecycle operation',
  'error.connectionControllerNotInitialized': 'Connection controller not initialized',
  'error.connectionControllerInitFailed': 'Connection controller initialization failed',
  'error.modelPathEmpty': 'Model path cannot be empty',
  'error.unsupportedModelPathFormat': 'Unsupported model path format: {path}',
  'error.modelNameEmpty': 'Model name cannot be empty',
  'error.modelNameIllegal': 'Model name is invalid',
  'error.selectValidModelFolder': 'Please select a valid model folder',
  'error.cubism2ModelUnsupported':
    'Detected .model.json (Cubism 2) model. Cubism 2 has been deprecated, please use a .model3.json model instead.',
  'error.model3NotFound': 'No .model3.json model file found in this folder',
  'error.modelResourceIncomplete': 'Model resources incomplete',
  'error.desktopSourceUnavailable': 'Unable to get desktop capture source',
  'error.screenshotSourceUnavailable': 'Screenshot source unavailable, please try again later',
  'error.unknownTool': 'Unknown tool: {name}',
  'error.localHistoryResourceMissing': 'Local history resource does not exist',
  'error.onlyHttpMailtoProtocol': 'Only http/https/mailto protocol links are supported',
  'error.onlyResourceProtocol':
    'Only http/https/data/history-resource protocol resources are supported',
  'error.onlyResourceProtocolSave':
    'Only http/https/data/history-resource protocol resources can be saved',
  'error.windowNotFound': 'Current window not found',
  'error.settingsWindowMismatch': 'Settings window state mismatch',
  'error.cannotGetWindowInstance': 'Cannot get window instance',
  'error.cubismConfigMissing': 'Missing cubism.core config in package.json: {path}',
  'error.targetNotDirectory': 'Parent of target path is not a directory: {dir}',
  'error.redirectLimitExceeded': 'Redirect limit exceeded',
  'error.downloadFailed': 'Download failed: {status}',
  'error.attachmentTooLarge':
    'Attachment size exceeds inline limit ({limit} bytes) and server does not support resource upload',
  'error.resourceUploadFailed': 'Resource upload failed, cannot send large attachment',
  'error.sdkDownloadFailed': 'SDK download failed',
  'error.cubism3Only': 'This version only supports Cubism 3/4 .model3.json models.',
  'error.modelFileNotSpecified': 'Model file name not specified in model configuration',
  'error.webglContextFailed': 'Cannot get WebGL context',
  'error.microphoneAccess': 'Cannot access microphone, please check permissions',
  'error.recordingNotStarted': 'Recording not started',
  'error.recordingAlreadyStopped': 'Recording already stopped',
  'error.saveOfflineHistoryFailed': 'Failed to save offline history messages',
  'error.createTextureFailed': 'Failed to create texture',
  'error.loadTextureFailed': 'Failed to load texture: {path}',
  'error.loadFileFailed': 'Failed to load file: {path} ({status})',
  'error.expressionFallbackWarning':
    'Expression file had no executable parameters, fell back to native expression runtime',
  'error.desktopBehaviorIllegalParam': 'desktopBehavior:requestReveal parameter is invalid',
  'error.domainNotInjected': '{name} not injected',
  'error.textureLoadAllFailed': 'Texture loading failed: {textures}',
  'error.webglContextNotInitialized': 'WebGL context not initialized',

  // Settings — History media viewer
  'settings.history.mediaViewer.imageAlt': 'History message image enlarged preview',
  'settings.history.mediaViewer.closeHint': 'Press ESC or click empty area to close'
}

export default en
