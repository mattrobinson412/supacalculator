'use client'

import { Roboto_Flex, Instrument_Serif } from "next/font/google"

import "@workspace/ui/globals.css"
import { Providers } from "@/components/providers"
import { Sidebar } from "@/components/Sidebar"
import { ThemeToggle } from "@/components/ThemeToggle"

const fontSans = Roboto_Flex({
  subsets: ["latin"],
  variable: "--font-sans"
})

const fontMono = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400"],
  style: ["normal", "italic"],
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fontSans.variable} ${fontMono.variable} font-sans antialiased bg-background`}
      >
        <Providers>
          <div className="flex h-screen">
            <Sidebar />
            <div className="flex-1 overflow-auto">
              <header className="border-b bg-background p-4 flex items-center justify-between">
                <Sidebar mobile />
                <ThemeToggle />
              </header>
              <main className="p-4">
                {children}
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  )   
}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  