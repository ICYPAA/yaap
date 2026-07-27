const { withDangerousMod } = require("expo/config-plugins")
const fs = require("node:fs")
const path = require("node:path")

const fallback = `    @unknown default:
      return "iso8601"
`

module.exports = function withXcode26Localization(config) {
  return withDangerousMod(config, [
    "ios",
    async (dangerousConfig) => {
      const packageJsonPath = require.resolve("expo-localization/package.json", {
        paths: [dangerousConfig.modRequest.projectRoot]
      })
      const modulePath = path.join(
        path.dirname(packageJsonPath),
        "ios",
        "LocalizationModule.swift"
      )
      let contents = fs.readFileSync(modulePath, "utf8")

      if (contents.includes("@unknown default:")) return dangerousConfig

      const anchor = `    case .iso8601:
      return "iso8601"
`
      if (!contents.includes(anchor)) {
        throw new Error(
          "Could not find the expo-localization calendar switch anchor"
        )
      }

      contents = contents.replace(anchor, anchor + fallback)
      fs.writeFileSync(modulePath, contents)
      return dangerousConfig
    }
  ])
}
