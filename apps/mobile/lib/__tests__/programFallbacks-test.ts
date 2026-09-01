import { Program } from "../../types/program"
import { resolveProgramDetails } from "../programFallbacks"

const program = (id: number) => ({ id, title: `Program ${id}` }) as Program

describe("resolveProgramDetails", () => {
  it("prefers a matching direct program response", () => {
    const queried = program(65)
    const current = program(65)

    expect(resolveProgramDetails(queried, current, 65)).toBe(queried)
  })

  it("falls back to the program embedded in conference state", () => {
    const current = program(65)

    expect(resolveProgramDetails(null, current, 65)).toBe(current)
  })

  it("does not reuse a program for a different conference", () => {
    expect(resolveProgramDetails(null, program(66), 65)).toBeNull()
  })
})
