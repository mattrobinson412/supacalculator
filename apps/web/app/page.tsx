"use client"

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Database, Users, HardDrive, Code2, MessageCircle, FileText, Save } from "lucide-react"
import { useAuth } from '@/contexts/AuthContext'

export default function Page() {
  const { user, loading } = useAuth()
  const router = useRouter()

  if (loading) {
    return <div className="container p-4 flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user) {
    router.push('/auth')
    return null
  }

  return (
    <div className="container mx-auto p-8 max-w-4xl space-y-8 text-center">
      <h1 className="text-5xl font-bold text-primary mb-4">SupaCalculator</h1>
      <p className="text-xl text-muted-foreground mb-8">Compare Supabase pricing with competitors across services.</p>
      <div className="grid gap-4">
        <Button size="lg" className="w-full max-w-md mx-auto">Start Calculation</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-16">
        <Link href="/estimates">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow p-6">
            <CardHeader className="text-center">
              <FileText className="h-8 w-8 mx-auto mb-2 text-primary" />
              <CardTitle>Pricing Calculator</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Input usage for all services and get total estimate</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/saved-estimates">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow p-6">
            <CardHeader className="text-center">
              <Save className="h-8 w-8 mx-auto mb-2 text-primary" />
              <CardTitle>Saved Estimates</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">View and manage previous calculations</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
