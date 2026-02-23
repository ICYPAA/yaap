import { getTranslations } from "next-intl/server"
import Link from "next/link"

export default async function ProtectedPage() {
  const t = await getTranslations("pages.auth.authCodeError")
  return (
    <div className="flex-1 w-full flex flex-col gap-12">
      {t("ProtectedPage.message")}
      <Link href="/">{t("ProtectedPage.returnText")}</Link>
    </div>
  )
}
