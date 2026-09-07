const { withFinalizedMod } = require('expo/config-plugins')
const fs = require('node:fs/promises')
const path = require('node:path')

// Keep the official raster untouched. Android insets its drawable so all
// lettering stays inside the adaptive launcher's guaranteed circular safe zone.
module.exports = config => withFinalizedMod(config, ['android', async config => {
  if (config.modRequest.introspect) return config
  const res = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res')
  const drawable = path.join(res, 'drawable')
  await fs.mkdir(drawable, { recursive: true })
  await fs.writeFile(path.join(drawable, 'icypaa_foreground_inset.xml'),
    '<?xml version="1.0" encoding="utf-8"?>\n<inset xmlns:android="http://schemas.android.com/apk/res/android" android:drawable="@mipmap/ic_launcher_foreground" android:inset="18%" />\n')
  for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
    const file = path.join(res, 'mipmap-anydpi-v26', name)
    const xml = await fs.readFile(file, 'utf8')
    await fs.writeFile(file, xml.replace('@mipmap/ic_launcher_foreground', '@drawable/icypaa_foreground_inset'))
  }
  return config
}])
