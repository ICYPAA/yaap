import React from "react"
import renderer from "react-test-renderer"
import Safety from "../safety"

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null
}))

jest.mock("../../../context/CurrentConferenceContext", () => ({
  useCurrentConference: () => ({
    status: "active",
    currentProgramId: null,
    program: { id: 8999, ndah_content: null }
  })
}))

jest.mock("../../../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      borderRadius: { md: 8 },
      colors: {
        background: "#fff",
        error: "#f00",
        primary: "#06f",
        surface: "#eee",
        text: { primary: "#111", secondary: "#666" }
      },
      spacing: { sm: 4, md: 8, lg: 16, xl: 24 },
      typography: {
        body: { fontSize: 16 },
        h1: { fontSize: 28 },
        h2: { fontSize: 20 }
      }
    }
  })
}))

jest.mock("../../../lib/supabase", () => ({
  withDeviceId: jest.fn()
}))

describe("Safety", () => {
  it("shows fallback policy text and toggles it", async () => {
    let component!: ReturnType<typeof renderer.create>

    await renderer.act(async () => {
      component = renderer.create(<Safety />)
    })

    expect(JSON.stringify(component.toJSON())).toContain(
      "Our group endeavors to provide a safe meeting place"
    )

    await renderer.act(async () => {
      component.root.findByProps({ testID: "safety-policy-toggle" }).props.onPress()
    })

    expect(JSON.stringify(component.toJSON())).not.toContain(
      "Statement of Safety"
    )

    await renderer.act(async () => {
      component.root.findByProps({ testID: "safety-policy-toggle" }).props.onPress()
    })

    expect(JSON.stringify(component.toJSON())).toContain("Statement of Safety")

    await renderer.act(async () => {
      component.unmount()
    })
  })
})
