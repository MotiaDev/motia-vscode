import * as vscode from 'vscode'
import { isMotiaProject } from './utilities/projectDetector'
import { ServerManager } from './utilities/serverManager'
import { WorkbenchPanel } from './workbenchPanel'

// Status bar item for the Motia workbench
let statusBarItem: vscode.StatusBarItem

/**
 * Activates the extension
 * @param context The extension context
 */
export async function activate(context: vscode.ExtensionContext) {
  console.log('Activating Motia Workbench extension')

  try {
    // Check if the current workspace is a Motia project
    const isMotia = await isMotiaProject()

    if (isMotia) {
      console.log('Motia project detected')

      // Create status bar item
      statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
      statusBarItem.text = '$(tools) Motia'
      statusBarItem.tooltip = 'Open Motia Workbench'
      statusBarItem.command = 'motia.openWorkbench'
      statusBarItem.show()
      context.subscriptions.push(statusBarItem)

      // Register commands
      context.subscriptions.push(
        vscode.commands.registerCommand('motia.openWorkbench', async () => {
          try {
            // Check if server is running before opening workbench
            const isRunning = await ServerManager.isServerRunning()
            
            if (isRunning) {
              // Server is running, open workbench directly
              await WorkbenchPanel.createOrShow(context.extensionUri)
            } else {
              // Server is not running, ask user if they want to start it
              const startServer = 'Start Server'
              const openAnyway = 'Open Anyway'
              
              const choice = await vscode.window.showInformationMessage(
                'The Motia server is not running. Would you like to start it?',
                startServer,
                openAnyway
              )
              
              if (choice === startServer) {
                // Start server with progress indicator
                await vscode.window.withProgress(
                  {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Starting Motia server...',
                    cancellable: false,
                  },
                  async (progress) => {
                    try {
                      // Start server and open workbench when ready
                      await ServerManager.startServer(context.extensionUri)
                    } catch (error) {
                      vscode.window.showErrorMessage(`Failed to start Motia server: ${error.message}`)
                      // Open workbench anyway to show the server not running screen
                      await WorkbenchPanel.createOrShow(context.extensionUri)
                    }
                  }
                )
              } else if (choice === openAnyway) {
                // Open workbench without starting server
                await WorkbenchPanel.createOrShow(context.extensionUri)
              }
            }
          } catch (error) {
            vscode.window.showErrorMessage(`Error opening Motia workbench: ${error.message}`)
          }
        }),
      )

      context.subscriptions.push(
        vscode.commands.registerCommand('motia.startServer', async () => {
          try {
            await vscode.window.withProgress(
              {
                location: vscode.ProgressLocation.Notification,
                title: 'Starting Motia server...',
                cancellable: false,
              },
              async (progress) => {
                try {
                  await ServerManager.startServer(context.extensionUri)
                } catch (error) {
                  vscode.window.showErrorMessage(`Failed to start Motia server: ${error.message}`)
                }
              }
            )
          } catch (error) {
            vscode.window.showErrorMessage(`Error starting Motia server: ${error.message}`)
          }
        }),
      )

      context.subscriptions.push(
        vscode.commands.registerCommand('motia.stopServer', async () => {
          try {
            await ServerManager.stopServer()
          } catch (error) {
            vscode.window.showErrorMessage(`Error stopping Motia server: ${error.message}`)
          }
        }),
      )

      // Auto-start server if configured
      const config = vscode.workspace.getConfiguration('motia')
      const autoStartServer = config.get<boolean>('autoStartServer', false)
      if (autoStartServer) {
        try {
          await ServerManager.startServer(context.extensionUri)
        } catch (error) {
          console.error('Error auto-starting Motia server:', error)
          // Don't show error message for auto-start failures to avoid annoying users
        }
      }
    } else {
      console.log('No Motia project detected')
    }
  } catch (error) {
    console.error('Error activating Motia extension:', error)
  }
}

/**
 * Deactivates the extension
 */
export function deactivate() {
  // Stop the server when the extension is deactivated
  try {
    ServerManager.stopServer().catch(error => {
      console.error('Error stopping Motia server during deactivation:', error)
    })
  } catch (error) {
    console.error('Error during Motia extension deactivation:', error)
  }
}
