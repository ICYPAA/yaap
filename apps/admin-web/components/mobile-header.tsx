"use client"

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle
} from "@/components/ui/navigation-menu"
import { Menu, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
export default function MobileHeader({ user }: any) {
  const [isOpen, setIsOpen] = useState(false)
  const t = useTranslations("components.mobile-header")

  return (
    <>
      <NavigationMenu className="z-20">
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger className="text-sm font-medium text-muted-foreground hover:text-primary">
              {isOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              {user && (
                <NavigationMenuLink
                  href="/host"
                  className={navigationMenuTriggerStyle()}
                >
                  {t("navigationMenu.dashboard")}
                </NavigationMenuLink>
              )}
              <NavigationMenuLink
                href="/program"
                className={navigationMenuTriggerStyle()}
              >
                Program
              </NavigationMenuLink>
              <NavigationMenuLink
                href="/merch"
                className={navigationMenuTriggerStyle()}
              >
                Merch
              </NavigationMenuLink>
              <NavigationMenuLink
                href="/travel"
                className={navigationMenuTriggerStyle()}
              >
                {t("navigationMenu.travel")}
              </NavigationMenuLink>
              <NavigationMenuLink
                href="/volunteer"
                className={navigationMenuTriggerStyle()}
              >
                Volunteer
              </NavigationMenuLink>
              <NavigationMenuLink
                href="/resources"
                className={navigationMenuTriggerStyle()}
              >
                Resources
              </NavigationMenuLink>
              {/* <NavigationMenuLink
                href="/outreach"
                className={navigationMenuTriggerStyle()}
              >
                Outreach
              </NavigationMenuLink>
              <NavigationMenuLink
                href="/transportation"
                className={navigationMenuTriggerStyle()}
              >
                Transportation
              </NavigationMenuLink>
              <NavigationMenuLink
                href="/resources"
                className={navigationMenuTriggerStyle()}
              >
                Resources
              </NavigationMenuLink>
              <NavigationMenuLink
                href="/service"
                className={navigationMenuTriggerStyle()}
              >
                Service Projects
              </NavigationMenuLink> */}
              <NavigationMenuLink
                href="/bylaws"
                className={navigationMenuTriggerStyle()}
              >
                Bylaws
              </NavigationMenuLink>
              <NavigationMenuLink
                href="https://www.icypaa.org/"
                className={navigationMenuTriggerStyle()}
              >
                icypaa.org
              </NavigationMenuLink>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </>
  )
}
