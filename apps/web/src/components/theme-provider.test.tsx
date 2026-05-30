import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ThemeProvider } from "./theme-provider"

describe("ThemeProvider", () => {
  it("renders children", () => {
    render(
      <ThemeProvider>
        <div data-testid="child" />
      </ThemeProvider>,
    )

    expect(screen.getByTestId("child")).toBeInTheDocument()
  })

  it("applies dark class when default theme is dark", () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <div />
      </ThemeProvider>,
    )

    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })

  it("applies light class when default theme is light", () => {
    render(
      <ThemeProvider defaultTheme="light">
        <div />
      </ThemeProvider>,
    )

    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })
})