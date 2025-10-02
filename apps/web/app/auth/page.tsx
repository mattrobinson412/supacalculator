"use client"

import { useState, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Mail } from "lucide-react"
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    // Optional: Check if already signed in, redirect to /estimates
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/estimates')
      }
    }
    checkSession()
  }, [router])

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/estimates`
        }
      })

      if (error) throw error

      setMessage('Check your email for the magic link. If you don\'t see it, check spam.')
      
      // Poll for session if link clicked in same tab
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
          router.push('/estimates')
        }
      })

      setTimeout(() => subscription.unsubscribe(), 10000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <h1 className="text-3xl font-bold">SupaCalculator</h1>
          </div>
          <CardTitle className="text-2xl text-center">Sign In</CardTitle>
          <p className="text-center text-sm text-muted-foreground">Enter your email to receive a magic link</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleMagicLink}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="you@example.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="pl-10" 
                  required 
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading || !email}>
              {loading ? 'Sending...' : 'Send Magic Link'}
            </Button>
          </form>
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          {message && <p className="text-sm text-muted-foreground text-center">{message}</p>}
        </CardContent>
      </Card>
    </div>
  )
}