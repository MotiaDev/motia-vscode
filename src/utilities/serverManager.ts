import { exec } from 'child_process'
import { promisify } from 'util'
import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import * as http from 'http'
import { WorkbenchPanel } from '../workbenchPanel'

/**
 * Manages the Motia development server
 */
export class ServerManager {
  private static _terminal: vscode.Terminal | undefined
  private static _isRunning = false
  private static _serverPort = 3000
  private static _serverStartTime = 0
  private static _maxStartupTime = 30000 // 30 seconds max wait time
  private static _execAsync = promisify(exec)

  /**
   * Check if a command exists in the system
   * @param command The command to check
   * @returns Promise<boolean> True if command exists
   */
  private static async commandExists(command: string): Promise<boolean> {
    try {
      const cmd = process.platform === 'win32' ? 'where' : 'which'
      await this._execAsync(`${cmd} ${command}`)
      return true
    } catch {
      return false
    }
  }

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
      // Get custom Node.js path if set
      const nodejsPath = config.get<string>('nodejsPath', '')
      
      // Validate Node.js path if one is specified
      if (nodejsPath) {
        const isValid = await this.validateNodejsPath()
        if (!isValid) {
          reject(new Error('Invalid Node.js path specified'))
          return
        }
      }

      // Check if server is already running
      const isRunning = await this.checkIfServerRunning(this._serverPort)
      if (isRunning) {
        vscode.window.showInformationMessage(`Motia server is already running on port ${this._serverPort}`)
        this._isRunning = true
        
        // If we need to open the workbench, do it now since server is already running
        if (extensionUri) {
          // Use a timeout to avoid circular dependency issues
          setTimeout(() => {
            WorkbenchPanel.createOrShow(extensionUri)
          }, 100)
        }
        
        resolve(true)
        return
      }

      // Create a new terminal
      this._terminal = vscode.window.createTerminal('Motia Dev Server')
      
      // Determine which package manager to use
      let command = `motia dev --verbose --port ${this._serverPort}`
      if(nodejsPath) {
        const isWin = process.platform === 'win32';
        command = `${isWin ? '& ' : ''}"${path.join(nodejsPath, isWin ? 'npx.cmd' : 'npx')}" ${command}`
      } else if (await this.commandExists('npx')) {
        command = `npx ${command}`
      } else if (await this.commandExists('pnpm')) {
        command = `pnpm ${command}`
      } else if (await this.commandExists('yarn')) {
        command = `yarn ${command}`
      } else {
        const message = 'Could not find a package manager to run the Motia server. Please install npx with: npm install -g npx'
        vscode.window.showErrorMessage(message)
        reject(new Error(message))
        return
      }

      this._terminal.sendText(command)
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
              WorkbenchPanel.createOrShow(extensionUri)
            }, 500)
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
      const options = {
        hostname: '127.0.0.1',
        port: port,
        path: '/',
        method: 'GET',
        timeout: 1000
      }

      const req = http.request(options, (res: any) => {
        if (res.statusCode === 200) {
          resolve(true)
        } else {
          resolve(false)
        }
      })

      req.on('error', () => {
        resolve(false)
      })

      req.on('timeout', () => {
        req.destroy()
        resolve(false)
      })

      req.end()
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

  /**
   * Validates the specified Node.js path by checking if it exists and can execute
   * @returns Promise<boolean> True if the path is valid
   */
  public static async validateNodejsPath(): Promise<boolean> {
    try {
      const config = vscode.workspace.getConfiguration('motia')
      const nodejsPath = config.get<string>('nodejsPath', '')
      
      if (!nodejsPath) {
        vscode.window.showInformationMessage('Using system Node.js (no custom path specified)')
        return true // No custom path specified, so it's valid
      }
      
      // Check if the file exists
      if (!fs.existsSync(nodejsPath)) {
        vscode.window.showErrorMessage(`Node.js executable not found at: ${nodejsPath}`)
        return false
      }
      
      // Try to run node --version to verify it's a working executable
      try {
        const result = await this._execAsync(`"${path.join(nodejsPath, 'node')}" --version`)
        if (result.stdout && result.stdout.trim().startsWith('v')) {
          vscode.window.showInformationMessage(`Node.js validated: ${result.stdout.trim()}`)
          return true
        } else {
          vscode.window.showErrorMessage(`Invalid Node.js executable: does not return a valid version`)
          return false
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Error running Node.js: ${error.message}`)
        return false
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error validating Node.js path: ${error.message}`)
      return false
    }
  }
}
