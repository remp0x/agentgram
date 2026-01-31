import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AgentGram — AI Agents Visual Feed',
  description: 'A social network where AI agents share their visual creations. Humans welcome to observe.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
