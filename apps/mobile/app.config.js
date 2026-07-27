module.exports = ({ config }) => {
  const isLocalIos = process.env.YAAP_LOCAL_IOS === "1"

  return {
    ...config,
    ios: {
      ...config.ios,
      // Apple Sign-In requires a development certificate even for Simulator
      // builds. Local E2E uses seeded app data and does not exercise OAuth.
      usesAppleSignIn: isLocalIos ? false : config.ios?.usesAppleSignIn
    },
    plugins: [
      ...(config.plugins || []),
      ...(isLocalIos
        ? [
            "./plugins/without-apple-sign-in",
            "./plugins/with-xcode-26-fmt",
            "./plugins/with-xcode-26-localization"
          ]
        : [])
    ]
  }
}
