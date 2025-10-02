"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { FileText, Edit, Trash2, LogOut } from "lucide-react"
import Link from 'next/link'
import jsPDF from 'jspdf'
import { saveAs } from 'file-saver'
import Papa from 'papaparse'

interface Estimate {
  id: string
  name: string
  services: Array<{
    type: 'database' | 'auth' | 'storage' | 'functions' | 'realtime'
    data: any
    costs: Record<string, number> // {supabase: num, firebase: num, ...}
  }>
  total_cost: number
  created_at: string
}

// Export functions
const exportCSV = (estimate: Estimate) => {
  if (!estimate) {
    alert('No estimate selected')
    return
  }

  const providers: string[] = ['supabase', 'firebase', 'aws', 'neon', 'planetscale']
  const headers: string[] = ['Service', ...providers]

  const rows: string[][] = (estimate.services ?? [])
    .filter((s: any): s is { type: string; costs?: Record<string, number> } => !!s)
    .map((service) => {
      const row: string[] = [service.type]
      for (const provider of providers) {
        const cost = (service.costs ?? {})[provider] ?? 0
        row.push(Number(cost).toFixed(2))
      }
      return row
    })

  // Total row
  const totalRow: string[] = ['Total', Number(estimate.total_cost || 0).toFixed(2), '', '', '', '']

  const csvData: string[][] = [headers, ...rows, totalRow]
  const csv = Papa.unparse(csvData)
  const blob = new Blob([csv], { type: 'text/csv' })
  saveAs(blob, `estimate-${estimate.id || 'unknown'}.csv`)
}

// @ts-ignore
// For PDF, use map for lines
const exportPDF = (estimate: any) => {
  if (!estimate) {
    alert('No estimate selected')
    return
  }

  const doc = new jsPDF()
  doc.text(estimate.name || 'Estimate', 10, 10)
  doc.text(`Total: $${(estimate.total_cost || 0).toFixed(2)}`, 10, 20)

  const services = estimate.services || []
  for (let i = 0; i < services.length; i++) {
    const service = services[i]
    if (service && service.costs) {
      const y = 30 + (i * 10)
      doc.text(`${service.type}:`, 10, y)
      let x = 60
      const providers = ['supabase', 'firebase', 'aws', 'neon', 'planetscale']
      for (let j = 0; j < providers.length; j++) {
        const provider = providers[j]
        if (provider) {
          const cost = (service.costs as Record<string, number>)[provider] || 0
          doc.text(`${provider}: $${Number(cost).toFixed(2)}`, x, y)
          x += 40
        }
      }
    }
  }
  doc.save(`estimate-${estimate.id || 'unknown'}.pdf`)
}

export default function SavedEstimatesPage() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()

  // All hooks at top, unconditional
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // useQuery always called
  const { data: estimates = [], isLoading: estimatesLoading } = useQuery({
    queryKey: ['estimates', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data } = await supabase
        .from('estimates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      return data as Estimate[] || []
    },
    enabled: !!user,
  })

  // useMutation always called
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('estimates').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates', user?.id] })
    },
  })

  // Redirect in useEffect after hooks
  useEffect(() => {
    if (!user && !estimatesLoading) {
      router.push('/auth')
    }
  }, [user, estimatesLoading, router])

  if (estimatesLoading) {
    return <div className="container p-4 flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Saved Estimates</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
          <Link href="/estimates">
            <Button>New Estimate</Button>
          </Link>
        </div>
      </div>

      {(estimates || []).length > 0 ? (
        <div className="grid gap-6">
          {(estimates || []).map(estimate => (
            <Card key={estimate.id}>
              <CardHeader>
            <CardTitle>{estimate.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Created {new Date(estimate.created_at).toLocaleDateString()}
            </p>
              </CardHeader>
              <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-lg font-semibold">Total: ${(estimate.total_cost || 0).toFixed(2)}</span>
              <div className="flex flex-col sm:flex-row sm:justify-end sm:gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/estimates?editId=${estimate.id}`}>
                <Edit className="h-4 w-4 mr-1" />
                Edit
                  </Link>
                </Button>
                <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(estimate.id)}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {estimate.services.map((service: any) => (
                <div key={service.type} className="flex justify-between text-sm">
                  <span>{service.type.charAt(0).toUpperCase() + service.type.slice(1)}</span>
                  <span>${(service.costs as Record<string, number>).supabase?.toFixed(2) || '0.00'}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col w-100% sm:flex-row sm:gap-2">
              <Button variant="outline" size="sm" className="w-50%" onClick={() => {
                exportPDF(estimate)
              }}>
                Export PDF
              </Button>
              <Button variant="outline" size="sm" className="w-50% mt-2 sm:mt-0" onClick={() => exportCSV(estimate)}>
                Export CSV
              </Button>
            </div>
              </CardContent>
            </Card>
          ))}
        </div>
          ) : (
        <Card>
          <CardContent className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No saved estimates</h3>
            <p className="text-muted-foreground mb-4">Create your first estimate in the calculator.</p>
            <Link href="/estimates">
              <Button>Go to Calculator</Button>
            </Link>
          </CardContent>
        </Card>
          )}
    </div>
  )
}