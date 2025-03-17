import * as vscode from 'vscode'
import * as net from 'net'

/**
 * Manages the Motia development server
 */
export class ServerManager {
  private static _terminal: vscode.Terminal | undefined
  private static _isRunning = false
  private static _serverPort = 3000
  private static _serverStartTime = 0
  private static _maxStartupTime = 30000 // 30 seconds max wait time

  /**
   * Starts the Motia development server
   * @param extensionUri Optional extension URI for opening the workbench
   * @returns Promise that resolves when server is confirmed running or rejects on timeout
   */
  public static startServer(extensionUri?: vscode.Uri): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      // Get the server port from settings
      const config = vscode.workspace.getConfiguration('motia')
      this._serverPort = config.get<number>('serverPort', 3000)

      // Check if server is already running
      const isRunning = await this.checkIfServerRunning(this._serverPort)
      if (isRunning) {
        vscode.window.showInformationMessage(`Motia server is already running on port ${this._serverPort}`)
        this._isRunning = true
        
        // If we need to open the workbench, do it now since server is already running
        if (extensionUri) {
          // Use a timeout to avoid circular dependency issues
          setTimeout(() => {
            const { WorkbenchPanel } = require('../workbenchPanel')
            WorkbenchPanel.createOrShow(extensionUri)
          }, 100)
        }
        
        resolve(true)
        return
      }

      // Create a new terminal
      this._terminal = vscode.window.createTerminal('Motia Dev Server')
      // Try different package managers in order of preference
      this._terminal.sendText(`
if command -v npx &> /dev/null; then
  npx motia dev --port ${this._serverPort}
elif command -v pnpm &> /dev/null; then
  pnpm run dev -- --port ${this._serverPort}
elif command -v yarn &> /dev/null; then
  yarn dev --port ${this._serverPort}
else
  echo "Could not find a package manager to run the Motia server"
  echo "Please install npx with: npm install -g npx"
  exit 1
fi
      `)
      this._terminal.show()
      
      // Record server start time
      this._serverStartTime = Date.now()
      
      // Start polling to check if server is running
      this._pollServerStatus(extensionUri, resolve, reject)
    })
  }

  /**
   * Polls the server status until it's running or times out
   * @param extensionUri Optional extension URI for opening the workbench
   * @param resolve Promise resolve function
   * @param reject Promise reject function
   */
  private static _pollServerStatus(
    extensionUri?: vscode.Uri, 
    resolve?: (value: boolean) => void,
    reject?: (reason: any) => void
  ): void {
    const checkInterval = 500 // Check every 500ms
    const checkServer = async () => {
      try {
        const isRunning = await this.checkIfServerRunning(this._serverPort)
        
        if (isRunning) {
          // Server is running
          this._isRunning = true
          vscode.window.showInformationMessage(`Motia server started on port ${this._serverPort}`)
          
          // If we need to open the workbench, do it now
          if (extensionUri) {
            // Use a timeout to avoid circular dependency issues
            setTimeout(() => {
              const { WorkbenchPanel } = require('../workbenchPanel')
              WorkbenchPanel.createOrShow(extensionUri)
            }, 100)
          }
          
          if (resolve) resolve(true)
          return
        }
        
        // Check if we've exceeded the maximum startup time
        if (Date.now() - this._serverStartTime > this._maxStartupTime) {
          vscode.window.showErrorMessage(`Motia server failed to start within ${this._maxStartupTime/1000} seconds`)
          this._isRunning = false
          if (reject) reject(new Error('Server startup timeout'))
          return
        }
        
        // Not running yet and not timed out, check again after interval
        setTimeout(checkServer, checkInterval)
      } catch (error) {
        // Error checking server status
        if (reject) reject(error)
      }
    }
    
    // Start checking
    setTimeout(checkServer, checkInterval)
  }

  /**
   * Stops the Motia development server
   * @returns Promise that resolves when server is stopped
   */
  public static stopServer(): Promise<void> {
    return new Promise(async (resolve) => {
      if (this._terminal) {
        this._terminal.dispose()
        this._terminal = undefined
        this._isRunning = false
        vscode.window.showInformationMessage('Motia server stopped')
      } else {
        vscode.window.showInformationMessage('No Motia server is running')
      }
      
      // Double-check that the server is actually stopped
      const isStillRunning = await this.checkIfServerRunning(this._serverPort)
      if (isStillRunning) {
        vscode.window.showWarningMessage(
          `Server is still running on port ${this._serverPort}. You may need to terminate it manually.`
        )
      }
      
      resolve()
    })
  }

  /**
   * Checks if the server is running
   * @param port The port to check
   * @returns A promise that resolves to true if the server is running
   */
  public static checkIfServerRunning(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket()

      const onError = () => {
        socket.destroy()
        resolve(false)
      }

      socket.setTimeout(1000)
      socket.once('error', onError)
      socket.once('timeout', onError)

      socket.connect(port, '127.0.0.1', () => {
        socket.end()
        resolve(true)
      })
    })
  }

  /**
   * Gets the server status by actually checking if it's running
   * @returns Promise that resolves to true if the server is running
   */
  public static isServerRunning(): Promise<boolean> {
    return this.checkIfServerRunning(this._serverPort)
  }
  
  /**
   * Gets the cached server status without checking
   * @returns true if the server is believed to be running
   */
  public static getServerStatus(): boolean {
    return this._isRunning
  }
}
