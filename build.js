const webpack = require('webpack');
const config = require('./webpack.config.js');

webpack(config, (err, stats) => {
  if (err) {
    console.error('Webpack error:', err);
    return;
  }

  if (stats.hasErrors()) {
    console.error('Webpack stats errors:', stats.toString({
      colors: true,
      errorDetails: true
    }));
    return;
  }

  console.log('Build completed successfully!');
  console.log(stats.toString({
    colors: true,
    modules: false,
    children: false,
    chunks: false,
    chunkModules: false
  }));
});
