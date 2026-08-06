module.exports = ({ config }) => {
  const isLocalIos = process.env.YAAP_LOCAL_IOS === "1"

  return {
    ...config,
    ios: {
      ...config.ios,
      // Apple Sign-In requires a development certificate even for Simulator
      // builds. Local E2E uses seeded app data and does not exercise OAuth.
      usesAppleSignIn: isLocalIos ? false : config.ios?.usesAppleSignIn,
      infoPlist: {
        ...config.ios?.infoPlist,
        // Expo SDK 55 adds a floating dev-tools button that overlaps the
        // tutorial's Skip control. Keep it out of local automated runs.
        ...(isLocalIos ? { EXDevMenuShowFloatingActionButton: false } : {})
      }
    },
    plugins: [
      ...(config.plugins || []),
      ...(isLocalIos
        ? ["./plugins/without-apple-sign-in"]
        : [])
    ]
  }
}
