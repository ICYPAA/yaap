import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle
} from "@/components/ui/navigation-menu"
import { getTranslations } from "next-intl/server"
import Link from "next/link.js"

export default async function HeaderMenu({ user }: any) {
  const t = await getTranslations("components.header")

  return (
    <div className="relative z-50 hidden md:flex justify-center space-x-4 items-center">
      {user && (
        <Link
          href="/host"
          className="text-sm font-medium text-muted-foreground hover:text-primary"
        >
          {t("navigationMenu.dashboard")}
        </Link>
      )}
      <Link
        href="/program"
        className="text-sm font-medium text-muted-foreground hover:text-primary"
      >
        Program
      </Link>
      <Link
        href="/merch"
        className="text-sm font-medium text-muted-foreground hover:text-primary"
      >
        Merch
      </Link>
      <Link
        href="/volunteer"
        className="text-sm font-medium text-muted-foreground hover:text-primary"
      >
        Volunteer
      </Link>
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger className="text-sm font-medium text-muted-foreground hover:text-primary">
              {t("trigger")}
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <NavigationMenuLink
                className={navigationMenuTriggerStyle()}
                href="/travel"
              >
                {t("navigationMenu.travel")}
              </NavigationMenuLink>
              {/*    <NavigationMenuLink
                              className={navigationMenuTriggerStyle()}
                              href="/outreach"
                            >
                              Outreach
                            </NavigationMenuLink>
                            <NavigationMenuLink
                              className={navigationMenuTriggerStyle()}
                              href="/transportation"
                            >
                              Transportation
                            </NavigationMenuLink>
                            */}
              <NavigationMenuLink
                className={navigationMenuTriggerStyle()}
                href="/resources"
              >
                Resources
              </NavigationMenuLink>
              <NavigationMenuLink
                className={navigationMenuTriggerStyle()}
                href="https://docs.google.com/document/d/e/2PACX-1vT1IoIDgUBTL_rIZZ-Z-irfDXLRp7cm7YSus5YVHX0mhJc-_39uV-Uz5jKcTG205A/pub"
              >
                {t("navigationMenu.bylaws")}
              </NavigationMenuLink>
              {/*<NavigationMenuLink
                              className={navigationMenuTriggerStyle()}
                              href="/service"
                            >
                              Service Projects
                            </NavigationMenuLink> */}
              <NavigationMenuLink
                className={navigationMenuTriggerStyle()}
                href="https://www.icypaa.org/"
              >
                icypaa.org
              </NavigationMenuLink>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  )
}
