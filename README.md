# Motia Workbench for VS Code

A VS Code extension that integrates the Motia Workbench directly into your editor.

## Features

- Open the Motia Workbench directly within VS Code
- Start and stop the Motia development server from VS Code
- Automatically detect Motia projects
- Configure server settings through VS Code preferences

## Requirements

- VS Code 1.80.0 or higher
- A Motia project (with the `@motiadev` packages installed)

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Motia Workbench"
4. Click Install

### Manual Installation

1. Download the `.vsix` file from the [releases page](https://github.com/motiadev/motia-vscode/releases)
2. In VS Code, go to Extensions (Ctrl+Shift+X)
3. Click the "..." menu and select "Install from VSIX..."
4. Select the downloaded file

## Usage

### Opening the Workbench

1. Open a Motia project in VS Code
2. Click the Motia icon in the status bar or run the "Motia: Open Workbench" command from the command palette (Ctrl+Shift+P)

### Starting/Stopping the Server

- Use the "Motia: Start Development Server" command to start the Motia development server
- Use the "Motia: Stop Development Server" command to stop the server

## Extension Settings

This extension contributes the following settings:

- `motia.serverPort`: Port for the Motia development server (default: 3000)
- `motia.autoStartServer`: Automatically start the server when a Motia project is detected (default: false)

## Known Issues

- The extension currently requires the Motia development server to be running to display the workbench

## Release Notes

For a detailed list of changes, see the [CHANGELOG](./CHANGELOG.md).

## Development

### Building the Extension

1. Clone the repository
2. Run `npm install`
3. Run `npm run compile` to build the extension
4. Press F5 to launch the extension in a new VS Code window

### Publishing the Extension

#### Manual Publishing

1. Update the version in `package.json` (follow [semver](https://semver.org/))
2. Run `npm run publish` to package and publish the extension
3. Alternatively, use convenience scripts:
   - `npm run publish:patch` - Bump patch version and publish
   - `npm run publish:minor` - Bump minor version and publish

#### Automated Publishing

The extension can be published automatically using GitHub Actions:

1. Go to the GitHub repository Actions tab
2. Select the "Publish Extension" workflow
3. Click "Run workflow"
4. Select the version bump type (patch, minor, or major)
5. Click "Run workflow"

This will:
- Bump the version according to your selection
- Build and package the extension
- Publish to VS Code Marketplace
- Create a GitHub release with the new version

**Note:** This requires a VS Code Marketplace Personal Access Token (PAT) stored as a GitHub secret named `VSCE_PAT`.

## License

This extension is licensed under the same terms as the Motia framework.
# motia-vscode
