import * as vscode from 'vscode'
import { ServerManager } from './utilities/serverManager'

/**
 * Manages the webview panel for the Motia workbench
 */
export class WorkbenchPanel {
  public static currentPanel: WorkbenchPanel | undefined
  private readonly _panel: vscode.WebviewPanel
  private _disposables: vscode.Disposable[] = []
  private _extensionUri: vscode.Uri

  /**
   * Creates or shows the workbench panel
   * @param extensionUri The extension URI
   */
  public static async createOrShow(extensionUri: vscode.Uri): Promise<void> {
    const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined

    // If we already have a panel, show it and update it
    if (WorkbenchPanel.currentPanel) {
      WorkbenchPanel.currentPanel._panel.reveal(column)
      await WorkbenchPanel.currentPanel._update()
      return
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'motiaWorkbench',
      'Motia Workbench',
      column || vscode.ViewColumn.One,
      {
        // Enable scripts in the webview
        enableScripts: true,
        // Restrict the webview to only load content from our extension directory
        localResourceRoots: [extensionUri],
        // Retain context when hidden
        retainContextWhenHidden: true,
      },
    )

    WorkbenchPanel.currentPanel = new WorkbenchPanel(panel, extensionUri)
    
    // Initial update
    await WorkbenchPanel.currentPanel._update()
  }

  /**
   * Constructor
   * @param panel The webview panel
   * @param extensionUri The extension URI
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel
    this._extensionUri = extensionUri

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables)

    // Update the content based on view changes
    this._panel.onDidChangeViewState(
      async (e) => {
        if (this._panel.visible) {
          await this._update()
        }
      },
      null,
      this._disposables,
    )

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        try {
          switch (message.command) {
            case 'alert':
              vscode.window.showErrorMessage(message.text)
              return
            case 'startServer':
              // Show a progress notification while starting the server
              await vscode.window.withProgress(
                {
                  location: vscode.ProgressLocation.Notification,
                  title: 'Starting Motia server...',
                  cancellable: false,
                },
                async (progress) => {
                  try {
                    await ServerManager.startServer()
                    // Update the panel after server starts
                    await this._update()
                  } catch (error) {
                    vscode.window.showErrorMessage(`Failed to start Motia server: ${error.message}`)
                  }
                }
              )
              return
            case 'checkServerStatus':
              // Check server status and update the panel
              await this._update()
              return
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Error handling message: ${error.message}`)
        }
      },
      null,
      this._disposables,
    )
  }

  /**
   * Disposes the panel
   */
  public dispose(): void {
    WorkbenchPanel.currentPanel = undefined

    // Clean up our resources
    this._panel.dispose()

    while (this._disposables.length) {
      const x = this._disposables.pop()
      if (x) {
        x.dispose()
      }
    }
  }

  /**
   * Updates the webview content
   */
  private async _update(): Promise<void> {
    this._panel.title = 'Motia Workbench'
    this._panel.webview.html = await this._getHtmlForWebview()
  }

  /**
   * Gets the HTML for the webview
   * @returns The HTML for the webview
   */
  private async _getHtmlForWebview(): Promise<string> {
    // Get the server port from settings
    const config = vscode.workspace.getConfiguration('motia')
    const port = config.get<number>('serverPort', 3000)

    // Check if server is running (using the async method)
    const isServerRunning = await ServerManager.isServerRunning()
    
    if (!isServerRunning) {
      return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Motia Workbench</title>
            <style>
                body {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                    padding: 0;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                }
                .container {
                    text-align: center;
                    padding: 2rem;
                }
                button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 0.5rem 1rem;
                    font-size: 1rem;
                    cursor: pointer;
                    margin-top: 1rem;
                }
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .status {
                    margin-top: 1rem;
                    padding: 0.5rem;
                    border-radius: 4px;
                }
                .error {
                    background-color: var(--vscode-inputValidation-errorBackground);
                    color: var(--vscode-inputValidation-errorForeground);
                    border: 1px solid var(--vscode-inputValidation-errorBorder);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Motia Workbench</h1>
                <p>The Motia development server is not running.</p>
                <button id="startServer">Start Server</button>
                <div id="status" class="status" style="display: none;"></div>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                
                // Store state
                let serverStarting = false;
                
                document.getElementById('startServer').addEventListener('click', () => {
                    if (serverStarting) return;
                    
                    serverStarting = true;
                    const statusEl = document.getElementById('status');
                    statusEl.textContent = 'Starting server...';
                    statusEl.className = 'status';
                    statusEl.style.display = 'block';
                    
                    document.getElementById('startServer').disabled = true;
                    
                    vscode.postMessage({
                        command: 'startServer'
                    });
                    
                    // Start polling for server status
                    const checkInterval = setInterval(() => {
                        vscode.postMessage({
                            command: 'checkServerStatus'
                        });
                    }, 1000);
                    
                    // Stop polling after 30 seconds to prevent indefinite polling
                    setTimeout(() => {
                        clearInterval(checkInterval);
                        if (serverStarting) {
                            serverStarting = false;
                            statusEl.textContent = 'Server startup timed out. Please try again.';
                            statusEl.className = 'status error';
                            document.getElementById('startServer').disabled = false;
                        }
                    }, 30000);
                });
                
                // Handle errors
                window.addEventListener('error', (event) => {
                    vscode.postMessage({
                        command: 'alert',
                        text: 'Error: ' + event.message
                    });
                });
            </script>
        </body>
        </html>
      `;
    }

    // Return the HTML for the webview with an iframe to the local server
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Motia Workbench</title>
          <style>
              body, html, iframe {
                  margin: 0;
                  padding: 0;
                  height: 100%;
                  width: 100%;
                  overflow: hidden;
              }
              .error-container {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  padding: 2rem;
                  text-align: center;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                  color: var(--vscode-foreground);
                  background-color: var(--vscode-editor-background);
              }
              .hidden {
                  display: none;
              }
              button {
                  background-color: var(--vscode-button-background);
                  color: var(--vscode-button-foreground);
                  border: none;
                  padding: 0.5rem 1rem;
                  font-size: 1rem;
                  cursor: pointer;
                  margin-top: 1rem;
              }
          </style>
      </head>
      <body>
          <iframe id="workbenchFrame" src="http://localhost:${port}" frameborder="0" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
          <div id="errorContainer" class="error-container hidden">
              <h2>Connection Error</h2>
              <p>Unable to connect to the Motia server at <code>http://localhost:${port}</code></p>
              <p>The server may have stopped responding.</p>
              <button id="refreshBtn">Refresh</button>
              <button id="restartServerBtn">Restart Server</button>
          </div>
          
          <script>
              const vscode = acquireVsCodeApi();
              const frame = document.getElementById('workbenchFrame');
              const errorContainer = document.getElementById('errorContainer');
              
              // Handle iframe load errors
              frame.addEventListener('error', handleFrameError);
              
              // Also set a timeout to check if the frame loaded successfully
              const frameLoadTimeout = setTimeout(handleFrameError, 5000);
              
              frame.addEventListener('load', () => {
                  clearTimeout(frameLoadTimeout);
                  errorContainer.classList.add('hidden');
                  frame.classList.remove('hidden');
              });
              
              function handleFrameError() {
                  frame.classList.add('hidden');
                  errorContainer.classList.remove('hidden');
              }
              
              // Add event listeners to buttons
              document.getElementById('refreshBtn').addEventListener('click', () => {
                  frame.src = "http://localhost:${port}";
                  frame.classList.remove('hidden');
                  errorContainer.classList.add('hidden');
              });
              
              document.getElementById('restartServerBtn').addEventListener('click', () => {
                  vscode.postMessage({
                      command: 'startServer'
                  });
              });
              
              // Periodically check server status
              setInterval(() => {
                  vscode.postMessage({
                      command: 'checkServerStatus'
                  });
              }, 5000);
          </script>
      </body>
      </html>
    `;
  }
}
