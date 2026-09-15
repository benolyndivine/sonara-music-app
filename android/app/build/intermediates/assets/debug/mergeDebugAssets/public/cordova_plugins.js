
  cordova.define('cordova/plugin_list', function(require, exports, module) {
    module.exports = [
      {
          "id": "cordova-plugin-media.Media",
          "file": "plugins/cordova-plugin-media/www/Media.js",
          "pluginId": "cordova-plugin-media",
        "clobbers": [
          "window.Media"
        ]
        },
      {
          "id": "cordova-plugin-media.MediaError",
          "file": "plugins/cordova-plugin-media/www/MediaError.js",
          "pluginId": "cordova-plugin-media",
        "clobbers": [
          "window.MediaError"
        ]
        }
    ];
    module.exports.metadata =
    // TOP OF METADATA
    {
      "cordova-plugin-media": "7.0.0"
    };
    // BOTTOM OF METADATA
    });
    