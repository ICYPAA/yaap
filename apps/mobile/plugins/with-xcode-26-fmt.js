const { withDangerousMod } = require("expo/config-plugins")
const fs = require("node:fs")
const path = require("node:path")

const marker = "# YAAP: Xcode 26 fmt consteval workaround"

module.exports = function withXcode26Fmt(config) {
  return withDangerousMod(config, [
    "ios",
    async (dangerousConfig) => {
      const podfilePath = path.join(
        dangerousConfig.modRequest.platformProjectRoot,
        "Podfile"
      )
      let contents = fs.readFileSync(podfilePath, "utf8")

      if (contents.includes(marker)) return dangerousConfig

      const anchor =
        "    # This is necessary for Xcode 14, because it signs resource bundles by default"
      if (!contents.includes(anchor)) {
        throw new Error("Could not find the Expo Podfile post-install anchor")
      }

      const workaround = `    ${marker}
    fmt_base = File.join(installer.sandbox.pod_dir('fmt'), 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      fmt_contents = File.read(fmt_base)
      patched_fmt = fmt_contents.gsub(
        /^#\\s*define FMT_USE_CONSTEVAL 1$/,
        '#  define FMT_USE_CONSTEVAL 0'
      )
      if patched_fmt != fmt_contents
        File.chmod(0644, fmt_base)
        File.write(fmt_base, patched_fmt)
      end
    end

`
      contents = contents.replace(anchor, workaround + anchor)
      fs.writeFileSync(podfilePath, contents)
      return dangerousConfig
    }
  ])
}
