import { expect, test, type Page } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

function readLocalEnvironment() {
  return Object.fromEntries(
    readFileSync(resolve(process.cwd(), ".env.local"), "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=")
        return [line.slice(0, separator), line.slice(separator + 1)]
      })
  )
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/")
  await page.getByTestId("local-email").fill(email)
  await page.getByTestId("local-password").fill(password)
  await page.getByTestId("local-sign-in").click()
  await expect(page).toHaveURL(/\/host$/)
}

test("administrator can manage the conference and access", async ({ page }) => {
  await signIn(page, "admin@yaap.local", "local-admin-password")

  await expect(
    page.getByRole("heading", { name: "Mobile App Control Board" })
  ).toBeVisible()
  await expect(
    page.getByText("Local Test Conference", { exact: true }).first()
  ).toBeVisible()
  await expect(page.getByText("active", { exact: true })).toBeVisible()

  await page.getByTestId("manage-conference-link").click()
  await expect(
    page.getByRole("heading", { name: "Program Management" })
  ).toBeVisible()
  await expect(
    page.getByText("Local Test Conference", { exact: true }).first()
  ).toBeVisible()

  await page.goto("/host")
  await page.getByTestId("manage-access-link").click()
  await expect(
    page.getByRole("heading", { name: "Access Control" })
  ).toBeVisible()
  await expect(page.getByText("Conference Manager")).toBeVisible()
  await expect(page.getByText("Read Only User")).toBeVisible()
})

test("conference manager can edit the conference but not access", async ({
  page
}) => {
  await signIn(page, "manager@yaap.local", "local-manager-password")

  await expect(page.getByTestId("manage-conference-link")).toBeVisible()
  await expect(page.getByTestId("manage-access-link")).toHaveCount(0)

  await page.goto("/host/program-management")
  await expect(
    page.getByRole("heading", { name: "Program Management" })
  ).toBeVisible()

  await page.goto("/host/role-management")
  await expect(
    page.getByText(/Only admins and steering members can view this page/i)
  ).toBeVisible()
})

test("view-only staff cannot change conference data", async ({ page }) => {
  await signIn(page, "viewer@yaap.local", "local-viewer-password")

  await expect(
    page.getByText("Your account has view-only access.")
  ).toBeVisible()
  await expect(page.getByTestId("manage-conference-link")).toHaveCount(0)

  await page.goto("/host/program-management")
  await expect(page.getByText("Access Denied", { exact: true })).toBeVisible()
})

test("legacy host tools are no longer exposed", async ({ page }) => {
  await signIn(page, "admin@yaap.local", "local-admin-password")

  await page.goto("/host/registration")
  await expect(page.getByText("This page could not be found.")).toBeVisible()
})

test("database enforces conference editor access", async () => {
  const environment = readLocalEnvironment()
  const clientOptions = {
    auth: { autoRefreshToken: false, persistSession: false }
  }
  const manager = createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    clientOptions
  )
  const viewer = createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    clientOptions
  )

  const managerSignIn = await manager.auth.signInWithPassword({
    email: "manager@yaap.local",
    password: "local-manager-password"
  })
  const viewerSignIn = await viewer.auth.signInWithPassword({
    email: "viewer@yaap.local",
    password: "local-viewer-password"
  })

  expect(managerSignIn.error).toBeNull()
  expect(viewerSignIn.error).toBeNull()

  const { data: program, error: readError } = await manager
    .from("programs")
    .select("description")
    .eq("id", 9001)
    .single()

  expect(readError).toBeNull()

  const managerUpdate = await manager
    .from("programs")
    .update({ description: program!.description })
    .eq("id", 9001)
    .select("id")

  const viewerUpdate = await viewer
    .from("programs")
    .update({ description: program!.description })
    .eq("id", 9001)
    .select("id")

  expect(managerUpdate.error).toBeNull()
  expect(managerUpdate.data).toHaveLength(1)
  expect(viewerUpdate.error).toBeNull()
  expect(viewerUpdate.data).toHaveLength(0)
})
