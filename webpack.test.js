const path = require('path');

module.exports = {
  target: 'node',
  entry: './src/test.ts',
  output: {
    path: path.resolve(__dirname, 'dist-test'),
    filename: 'test.js',
    libraryTarget: 'commonjs2'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  }
};
