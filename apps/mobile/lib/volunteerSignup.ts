export type VolunteerSignupConfiguration = {
  signup_destination?: "internal" | "external"
  external_signup_url?: string
}

/**
 * Returns a trusted external volunteer signup URL when the program is
 * configured to use SignUpGenius. Invalid or incomplete configuration falls
 * back to the app's internal volunteer form.
 */
export function getExternalVolunteerSignupUrl(
  configuration?: VolunteerSignupConfiguration
): string | null {
  if (configuration?.signup_destination !== "external") {
    return null
  }

  const configuredUrl = configuration.external_signup_url?.trim()
  if (!configuredUrl) {
    return null
  }

  try {
    const url = new URL(configuredUrl)
    const isSignupGenius =
      url.hostname === "signupgenius.com" ||
      url.hostname.endsWith(".signupgenius.com") ||
      url.hostname === "sugeni.us" ||
      url.hostname.endsWith(".sugeni.us")

    if (
      url.protocol !== "https:" ||
      !isSignupGenius ||
      url.username ||
      url.password ||
      url.port
    ) {
      return null
    }

    return configuredUrl
  } catch {
    return null
  }
}
