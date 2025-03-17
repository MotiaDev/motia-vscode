import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Checks if the current workspace is a Motia project
 * @returns true if the current workspace is a Motia project
 */
export async function isMotiaProject(): Promise<boolean> {
  // Get all workspace folders
  const workspaceFolders = vscode.workspace.workspaceFolders
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return false
  }

  // Check each workspace folder
  for (const folder of workspaceFolders) {
    // Check for steps directory
    const stepsPath = path.join(folder.uri.fsPath, 'steps')
    if (fs.existsSync(stepsPath) && fs.statSync(stepsPath).isDirectory()) {
      return true
    }

    // Check for package.json with Motia dependencies
    const packageJsonPath = path.join(folder.uri.fsPath, 'package.json')
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
        const dependencies = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        }

        // Check for Motia dependencies
        const hasMotiaDependency = Object.keys(dependencies || {}).some(
          (dep) => dep.startsWith('@motiadev/') || dep === 'motia',
        )

        if (hasMotiaDependency) {
          return true
        }
      } catch (error) {
        console.error('Error parsing package.json:', error)
      }
    }
  }

  return false
}
