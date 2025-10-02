"use client"

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui/components/accordion"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Button } from "@workspace/ui/components/button"
import { Database, Users, HardDrive, Code2, MessageCircle, Save, LogOut, BarChart3 } from "lucide-react"
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts'

interface InputData {
  database: { storageGB: number, monthlyActiveRows: number, readsPerMonth: number, writesPerMonth: number }
  auth: { monthlyActiveUsers: number, signUpsPerMonth: number, emailVerifications: number }
  storage: { storageGB: number, downloadsGB: number, uploadsGB: number }
  functions: { invocationsPerMonth: number, averageDurationMs: number, memoryGB: number }
  realtime: { concurrentConnections: number, messagesPerMonth: number }
}

interface Costs {
  database: { supabase: number, firebase: number, aws: number, neon: number, planetscale: number }
  auth: { supabase: number, firebase: number, aws: number }
  storage: { supabase: number, firebase: number, aws: number }
  functions: { supabase: number, firebase: number, aws: number }
  realtime: { supabase: number, firebase: number, aws: number }
}

interface Estimate {
  id: string
  name: string
  services: Array<{
    type: 'database' | 'auth' | 'storage' | 'functions' | 'realtime'
    data: any
    costs: any
  }>
  total_cost: number
  created_at: string
}

function EstimatesClientContent() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const editId = searchParams.get('editId')

  // All hooks at top, unconditional
  const [inputData, setInputData] = useState<InputData>({
    database: { storageGB: 1, monthlyActiveRows: 10000, readsPerMonth: 100000, writesPerMonth: 50000 },
    auth: { monthlyActiveUsers: 10000, signUpsPerMonth: 1000, emailVerifications: 500 },
    storage: { storageGB: 10, downloadsGB: 50, uploadsGB: 20 },
    functions: { invocationsPerMonth: 100000, averageDurationMs: 100, memoryGB: 0.5 },
    realtime: { concurrentConnections: 100, messagesPerMonth: 1000000 }
  })
  const [costs, setCosts] = useState<Costs>({
    database: { supabase: 0, firebase: 0, aws: 0, neon: 0, planetscale: 0 },
    auth: { supabase: 0, firebase: 0, aws: 0 },
    storage: { supabase: 0, firebase: 0, aws: 0 },
    functions: { supabase: 0, firebase: 0, aws: 0 },
    realtime: { supabase: 0, firebase: 0, aws: 0 }
  })
  const [estimateName, setEstimateName] = useState('')

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
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('No user')

      const services = [
        { type: 'database', data: inputData.database, costs: costs.database },
        { type: 'auth', data: inputData.auth, costs: costs.auth },
        { type: 'storage', data: inputData.storage, costs: costs.storage },
        { type: 'functions', data: inputData.functions, costs: costs.functions },
        { type: 'realtime', data: inputData.realtime, costs: costs.realtime }
      ]

      const { error } = await supabase
        .from('estimates')
        .insert({
          user_id: user.id,
          name: estimateName || 'New Estimate',
          services,
          total_cost: Object.values(costs).reduce((sum, service) => sum + service.supabase, 0)
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates', user?.id] })
      setEstimateName('')
    },
    onError: (error) => {
      alert('Failed to save estimate: ' + (error as Error).message)
    },
  })

  // Load saved estimate data if editing
  const { data: savedEstimate } = useQuery({
    queryKey: ['estimate', editId],
    queryFn: async () => {
      if (!editId) return null
      const { data } = await supabase.from('estimates').select('*').eq('id', editId).single()
      return data as Estimate
    },
    enabled: !!editId,
  })

  // Load saved data into inputData
  useEffect(() => {
    if (savedEstimate) {
      const newInputData = { ...inputData }
      savedEstimate.services.forEach(service => {
        if (service.type in newInputData) {
          newInputData[service.type] = service.data
        }
      })
      setInputData(newInputData)
      setEstimateName(savedEstimate.name)
    }
  }, [savedEstimate])

  // All side effects (auth redirect, cost calculation, subscription) 
  useEffect(() => {
    if (!user && !estimatesLoading) {
      router.push('/auth')
    }
  }, [user, estimatesLoading, router])

  useEffect(() => {
    // Calculate costs
    const dbSupabase = calculateDatabaseCost(inputData.database)
    const dbFirebase = calculateFirebaseDatabaseCost(inputData.database)
    const dbAws = calculateAWSDatabaseCost(inputData.database)
    const dbNeon = calculateNeonCost(inputData.database)
    const dbPlanetScale = calculatePlanetScaleCost(inputData.database)

    const authSupabase = calculateAuthCost(inputData.auth)
    const authFirebase = calculateFirebaseAuthCost(inputData.auth)
    const authAws = calculateAWSAuthCost(inputData.auth)

    const storageSupabase = calculateStorageCost(inputData.storage)
    const storageFirebase = calculateFirebaseStorageCost(inputData.storage)
    const storageAws = calculateAWSStorageCost(inputData.storage)

    const functionsSupabase = calculateFunctionsCost(inputData.functions)
    const functionsFirebase = calculateFirebaseFunctionsCost(inputData.functions)
    const functionsAws = calculateAWSFunctionsCost(inputData.functions)

    const realtimeSupabase = calculateRealtimeCost(inputData.realtime)
    const realtimeFirebase = calculateFirebaseRealtimeCost(inputData.realtime)
    const realtimeAws = calculateAWSRealtimeCost(inputData.realtime)

    setCosts({
      database: { supabase: dbSupabase, firebase: dbFirebase, aws: dbAws, neon: dbNeon, planetscale: dbPlanetScale },
      auth: { supabase: authSupabase, firebase: authFirebase, aws: authAws },
      storage: { supabase: storageSupabase, firebase: storageFirebase, aws: storageAws },
      functions: { supabase: functionsSupabase, firebase: functionsFirebase, aws: functionsAws },
      realtime: { supabase: realtimeSupabase, firebase: realtimeFirebase, aws: realtimeAws }
    })
  }, [inputData])

  // Realtime subscription
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('estimates-changes')
      .on('postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'estimates', 
          filter: `user_id=eq.${user.id}` 
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['estimates', user.id] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, queryClient])

  const totalSupabaseCost = Object.values(costs).reduce((sum, service) => sum + service.supabase, 0)

  const handleInputChange = (section: keyof InputData, field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0
    setInputData(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value }
    }))
  }

  const handleSave = () => {
    saveMutation.mutate()
  }

  // Calculation functions (refined)
  const calculateDatabaseCost = (data: any) => {
    const { storageGB, readsPerMonth, writesPerMonth } = data
    let cost = 25 // Pro base
    if (storageGB > 8) cost += (storageGB - 8) * 0.125
    const extraReads = Math.max(0, readsPerMonth - 5000000) / 100000 * 10
    const extraWrites = Math.max(0, writesPerMonth - 2000000) / 100000 * 10
    return Math.round((cost + extraReads + extraWrites) * 100) / 100
  }

  const calculateFirebaseDatabaseCost = (data: any) => {
    const { readsPerMonth, writesPerMonth } = data
    const readsCost = (readsPerMonth / 100000) * 0.06
    const writesCost = (writesPerMonth / 100000) * 0.18
    return Math.round((readsCost + writesCost) * 100) / 100
  }

  const calculateAWSDatabaseCost = (data: any) => {
    const { storageGB } = data
    const instanceCost = 12.5 // t4g.micro
    const storageCost = storageGB * 0.115
    return Math.round((instanceCost + storageCost) * 100) / 100
  }

  const calculateNeonCost = (data: any) => {
    const { storageGB } = data
    let cost = 20 // Pro base 10GB
    if (storageGB > 10) cost += (storageGB - 10) * 0.096
    return Math.round(cost * 100) / 100
  }

  const calculatePlanetScaleCost = (data: any) => {
    const { monthlyActiveRows } = data
    let cost = 29 // Scaler base
    const extraRows = Math.max(0, monthlyActiveRows - 5000000) * 0.0001
    cost += extraRows
    return Math.round(cost * 100) / 100
  }

  const calculateAuthCost = (data: any) => 0 // Included

  const calculateFirebaseAuthCost = (data: any) => {
    const { monthlyActiveUsers } = data
    const extraMAUs = Math.max(0, monthlyActiveUsers - 50000) * 0.0055
    return Math.round(extraMAUs * 100) / 100
  }

  const calculateAWSAuthCost = (data: any) => {
    const { monthlyActiveUsers } = data
    const extraMAUs = Math.max(0, monthlyActiveUsers - 50000) * 0.0055
    return Math.round(extraMAUs * 100) / 100
  }

  const calculateStorageCost = (data: any) => {
    const { storageGB, downloadsGB } = data
    let cost = 0
    if (storageGB > 5) cost += (storageGB - 5) * 0.021
    cost += downloadsGB * 0.09
    return Math.round(cost * 100) / 100
  }

  const calculateFirebaseStorageCost = (data: any) => {
    const { storageGB, downloadsGB } = data
    const storageCost = storageGB * 0.026
    const downloadCost = downloadsGB * 0.12
    return Math.round((storageCost + downloadCost) * 100) / 100
  }

  const calculateAWSStorageCost = (data: any) => {
    const { storageGB, downloadsGB } = data
    const storageCost = storageGB * 0.023
    const egressCost = Math.max(0, downloadsGB - 100) * 0.09 // Refined: first 100GB free
    return Math.round((storageCost + egressCost) * 100) / 100
  }

  const calculateFunctionsCost = (data: any) => {
    const { invocationsPerMonth, averageDurationMs, memoryGB } = data
    const extraInvocations = Math.max(0, invocationsPerMonth - 500000) / 100000 * 0.125
    const gbSeconds = invocationsPerMonth * (averageDurationMs / 1000) * memoryGB
    const extraGBs = Math.max(0, gbSeconds - 100000) * 0.0000025
    return Math.round((extraInvocations + extraGBs) * 100) / 100
  }

  const calculateFirebaseFunctionsCost = (data: any) => {
    const { invocationsPerMonth, averageDurationMs, memoryGB } = data
    const invocationCost = (invocationsPerMonth / 1000000) * 0.40
    const gbSeconds = invocationsPerMonth * (averageDurationMs / 1000) * memoryGB
    const computeCost = gbSeconds * 0.0000025
    return Math.round((invocationCost + computeCost) * 100) / 100
  }

  const calculateAWSFunctionsCost = (data: any) => {
    const { invocationsPerMonth, averageDurationMs, memoryGB } = data
    const requestCost = (invocationsPerMonth / 1000000) * 0.20
    const gbSeconds = invocationsPerMonth * (averageDurationMs / 1000) * memoryGB
    const computeCost = gbSeconds * 0.00001667
    return Math.round((requestCost + computeCost) * 100) / 100
  }

  const calculateRealtimeCost = (data: any) => {
    const { concurrentConnections, messagesPerMonth } = data
    const extraConnections = Math.max(0, concurrentConnections - 500) / 1000 * 10
    const extraMessages = Math.max(0, messagesPerMonth - 5000000) / 1000000 * 2.5
    return Math.round((extraConnections + extraMessages) * 100) / 100
  }

  const calculateFirebaseRealtimeCost = (data: any) => {
    const { messagesPerMonth } = data
    // Approximate as 50% reads, 50% writes
    const reads = (messagesPerMonth * 0.5) / 100000 * 0.06
    const writes = (messagesPerMonth * 0.5) / 100000 * 0.18
    return Math.round((reads + writes) * 100) / 100
  }

  const calculateAWSRealtimeCost = (data: any) => {
    const { concurrentConnections, messagesPerMonth } = data
    const operationsCost = (messagesPerMonth / 1000000) * 4
    const connectionCost = concurrentConnections * 0.002 // Approx per concurrent/month
    return Math.round((operationsCost + connectionCost) * 100) / 100
  }

  // Render: Loading if auth or query loading
  if (useAuth().loading || estimatesLoading) {
    return <div className="container p-4 flex items-center justify-center min-h-screen">Loading...</div>
  }

  // Content only if user
  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{savedEstimate ? 'Edit Estimate' : 'New Estimate'}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? 'Saving...' : 'Save Estimate'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estimate Name</CardTitle>
        </CardHeader>
        <CardContent>
          <Input 
            placeholder="Enter estimate name (optional)" 
            value={estimateName} 
            onChange={(e) => setEstimateName(e.target.value)} 
          />
        </CardContent>
      </Card>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="database">
          <AccordionTrigger className="p-4">Database</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Storage (GB)</Label>
                  <Input type="number" value={inputData.database.storageGB} onChange={handleInputChange('database', 'storageGB')} />
                </div>
                <div className="space-y-2">
                  <Label>Monthly Active Rows</Label>
                  <Input type="number" value={inputData.database.monthlyActiveRows} onChange={handleInputChange('database', 'monthlyActiveRows')} />
                </div>
                <div className="space-y-2">
                  <Label>Reads per Month</Label>
                  <Input type="number" value={inputData.database.readsPerMonth} onChange={handleInputChange('database', 'readsPerMonth')} />
                </div>
                <div className="space-y-2">
                  <Label>Writes per Month</Label>
                  <Input type="number" value={inputData.database.writesPerMonth} onChange={handleInputChange('database', 'writesPerMonth')} />
                </div>
              </div>

              <div className="flex justify-between">
                <span>Supabase Cost:</span>
                <span className="font-bold">${costs.database.supabase.toFixed(2)}</span>
              </div>

              {/* Competitor Comparison */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Competitors</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Firebase Firestore</span>
                    <span className="font-medium">${costs.database.firebase.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>AWS RDS</span>
                    <span className="font-medium">${costs.database.aws.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Neon</span>
                    <span className="font-medium">${costs.database.neon.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>PlanetScale</span>
                    <span className="font-medium">${costs.database.planetscale.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Cost Comparison</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[{ name: 'Database', ...costs.database }]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" hide />
                      <YAxis />
                      <Tooltip formatter={(value, name, props) => [`$${Number(value).toFixed(2)}`, props?.payload?.name || (name as string)]} />
                      <Legend />
                      <Bar dataKey="supabase" fill="#779a85ff" name="Supabase" />
                      <Bar dataKey="firebase" fill="#f97316" name="Firebase" />
                      <Bar dataKey="aws" fill="#3b82f6" name="AWS" />
                      <Bar dataKey="neon" fill="#a23e64ff" name="Neon" />
                      <Bar dataKey="planetscale" fill="#7c3aed" name="PlanetScale" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="auth">
          <AccordionTrigger className="p-4">Auth</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Monthly Active Users</Label>
                  <Input type="number" value={inputData.auth.monthlyActiveUsers} onChange={handleInputChange('auth', 'monthlyActiveUsers')} />
                </div>
                <div className="space-y-2">
                  <Label>Sign-ups per Month</Label>
                  <Input type="number" value={inputData.auth.signUpsPerMonth} onChange={handleInputChange('auth', 'signUpsPerMonth')} />
                </div>
                <div className="space-y-2">
                  <Label>Email Verifications</Label>
                  <Input type="number" value={inputData.auth.emailVerifications} onChange={handleInputChange('auth', 'emailVerifications')} />
                </div>
              </div>
              <div className="flex justify-between">
                <span>Auth Cost:</span>
                <span className="font-bold">${costs.auth.supabase.toFixed(2)}</span>
              </div>

              {/* Competitor Comparison */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Competitors</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Firebase Auth</span>
                    <span className="font-medium">${costs.auth.firebase.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>AWS Cognito</span>
                    <span className="font-medium">$0.0055/MAU over 50k</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Auth0</span>
                    <span className="font-medium">Custom pricing</span>
                  </div>
                </CardContent>
              </Card>

              {/* Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Cost Comparison</CardTitle>
                </CardHeader>
                <CardContent className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[{ name: 'Auth', ...costs.auth }]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" hide />
                      <YAxis />
                      <Tooltip formatter={(value, name, props) => [`$${Number(value).toFixed(2)}`, props?.payload?.name || (name as string)]} />
                      <Legend />
                      <Bar dataKey="supabase" fill="#779a85ff" name="Supabase" />
                      <Bar dataKey="firebase" fill="#f97316" name="Firebase" />
                      <Bar dataKey="aws" fill="#3b82f6" name="AWS" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="storage">
          <AccordionTrigger className="p-4">Storage</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Storage Used (GB)</Label>
                  <Input type="number" value={inputData.storage.storageGB} onChange={handleInputChange('storage', 'storageGB')} />
                </div>
                <div className="space-y-2">
                  <Label>Downloads (GB/month)</Label>
                  <Input type="number" value={inputData.storage.downloadsGB} onChange={handleInputChange('storage', 'downloadsGB')} />
                </div>
                <div className="space-y-2">
                  <Label>Uploads (GB/month)</Label>
                  <Input type="number" value={inputData.storage.uploadsGB} onChange={handleInputChange('storage', 'uploadsGB')} />
                </div>
              </div>
              <div className="flex justify-between">
                <span>Storage Cost:</span>
                <span className="font-bold">${costs.storage.supabase.toFixed(2)}</span>
              </div>

              {/* Competitor Comparison */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Competitors</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Firebase Storage</span>
                    <span className="font-medium">${costs.storage.firebase.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>AWS S3</span>
                    <span className="font-medium">Varies</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Backblaze B2</span>
                    <span className="font-medium">$0.005/GB</span>
                  </div>
                </CardContent>
              </Card>

              {/* Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Cost Comparison</CardTitle>
                </CardHeader>
                <CardContent className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[{ name: 'Storage', ...costs.storage }]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" hide />
                      <YAxis />
                      <Tooltip formatter={(value, name, props) => [`$${Number(value).toFixed(2)}`, props?.payload?.name || (name as string)]} />
                      <Legend />
                      <Bar dataKey="supabase" fill="#779a85ff" name="Supabase" />
                      <Bar dataKey="firebase" fill="#f97316" name="Firebase" />
                      <Bar dataKey="aws" fill="#3b82f6" name="AWS" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="functions">
          <AccordionTrigger className="p-4">Edge Functions</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Invocations per Month</Label>
                  <Input type="number" value={inputData.functions.invocationsPerMonth} onChange={handleInputChange('functions', 'invocationsPerMonth')} />
                </div>
                <div className="space-y-2">
                  <Label>Average Duration (ms)</Label>
                  <Input type="number" value={inputData.functions.averageDurationMs} onChange={handleInputChange('functions', 'averageDurationMs')} />
                </div>
                <div className="space-y-2">
                  <Label>Memory (GB)</Label>
                  <Input type="number" step="0.1" value={inputData.functions.memoryGB} onChange={handleInputChange('functions', 'memoryGB')} />
                </div>
              </div>
              <div className="flex justify-between">
                <span>Functions Cost:</span>
                <span className="font-bold">${costs.functions.supabase.toFixed(2)}</span>
              </div>

              {/* Competitor Comparison */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Competitors</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Cloud Functions</span>
                    <span className="font-medium">${costs.functions.firebase.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>AWS Lambda</span>
                    <span className="font-medium">Varies</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Azure Functions</span>
                    <span className="font-medium">Varies</span>
                  </div>
                </CardContent>
              </Card>

              {/* Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Cost Comparison</CardTitle>
                </CardHeader>
                <CardContent className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[{ name: 'Functions', ...costs.functions }]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" hide />
                      <YAxis />
                      <Tooltip formatter={(value, name, props) => [`$${Number(value).toFixed(2)}`, props?.payload?.name || (name as string)]} />
                      <Legend />
                      <Bar dataKey="supabase" fill="#779a85ff" name="Supabase" />
                      <Bar dataKey="firebase" fill="#f97316" name="Firebase" />
                      <Bar dataKey="aws" fill="#3b82f6" name="AWS" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="realtime">
          <AccordionTrigger className="p-4">Realtime</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Concurrent Connections</Label>
                  <Input type="number" value={inputData.realtime.concurrentConnections} onChange={handleInputChange('realtime', 'concurrentConnections')} />
                </div>
                <div className="space-y-2">
                  <Label>Messages per Month</Label>
                  <Input type="number" value={inputData.realtime.messagesPerMonth} onChange={handleInputChange('realtime', 'messagesPerMonth')} />
                </div>
              </div>
              <div className="flex justify-between">
                <span>Realtime Cost:</span>
                <span className="font-bold">${costs.realtime.supabase.toFixed(2)}</span>
              </div>

              {/* Competitor Comparison */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Competitors</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Firebase Realtime DB</span>
                    <span className="font-medium">${costs.realtime.firebase.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>AWS DynamoDB</span>
                    <span className="font-medium">Varies</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Azure Cosmos DB</span>
                    <span className="font-medium">Varies</span>
                  </div>
                </CardContent>
              </Card>

              {/* Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Cost Comparison</CardTitle>
                </CardHeader>
                <CardContent className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[{ name: 'Realtime', ...costs.realtime }]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" hide />
                      <YAxis />
                      <Tooltip formatter={(value, name, props) => [`$${Number(value).toFixed(2)}`, props?.payload?.name || (name as string)]} />
                      <Legend />
                      <Bar dataKey="supabase" fill="#779a85ff" name="Supabase" />
                      <Bar dataKey="firebase" fill="#f97316" name="Firebase" />
                      <Bar dataKey="aws" fill="#3b82f6" name="AWS" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Card>
        <CardHeader>
          <CardTitle>Total Estimate (Supabase)</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <div className="text-4xl font-bold text-primary mb-2">${totalSupabaseCost.toFixed(2)}</div>
          <p className="text-muted-foreground">Monthly cost across all services</p>
        </CardContent>
      </Card>

      {/* Saved Estimates */}
      <Card>
        <CardHeader>
          <CardTitle>Saved Estimates</CardTitle>
        </CardHeader>
        <CardContent>
          {estimatesLoading ? (
            <p>Loading...</p>
          ) : estimates.length > 0 ? (
            <div className="space-y-4">
              {estimates.map(estimate => (
                <Card key={estimate.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between">
                      <h3 className="font-semibold">{estimate.name}</h3>
                      <span className="font-bold">${estimate.total_cost.toFixed(2)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{new Date(estimate.created_at).toLocaleDateString()}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p>No saved estimates yet. Save your first calculation above.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Calculation functions (refined)
const calculateDatabaseCost = (data: any) => {
  const { storageGB, readsPerMonth, writesPerMonth } = data
  let cost = 25 // Pro base
  if (storageGB > 8) cost += (storageGB - 8) * 0.125
  const extraReads = Math.max(0, readsPerMonth - 5000000) / 100000 * 10
  const extraWrites = Math.max(0, writesPerMonth - 2000000) / 100000 * 10
  return Math.round((cost + extraReads + extraWrites) * 100) / 100
}

const calculateFirebaseDatabaseCost = (data: any) => {
  const { readsPerMonth, writesPerMonth } = data
  const readsCost = (readsPerMonth / 100000) * 0.06
  const writesCost = (writesPerMonth / 100000) * 0.18
  return Math.round((readsCost + writesCost) * 100) / 100
}

const calculateAWSDatabaseCost = (data: any) => {
  const { storageGB } = data
  const instanceCost = 12.5 // t4g.micro
  const storageCost = storageGB * 0.115
  return Math.round((instanceCost + storageCost) * 100) / 100
}

const calculateNeonCost = (data: any) => {
  const { storageGB } = data
  let cost = 20 // Pro base 10GB
  if (storageGB > 10) cost += (storageGB - 10) * 0.096
  return Math.round(cost * 100) / 100
}

const calculatePlanetScaleCost = (data: any) => {
  const { monthlyActiveRows } = data
  let cost = 29 // Scaler base
  const extraRows = Math.max(0, monthlyActiveRows - 5000000) * 0.0001
  cost += extraRows
  return Math.round(cost * 100) / 100
}

const calculateAuthCost = (data: any) => 0 // Included

const calculateFirebaseAuthCost = (data: any) => {
  const { monthlyActiveUsers } = data
  const extraMAUs = Math.max(0, monthlyActiveUsers - 50000) * 0.0055
  return Math.round(extraMAUs * 100) / 100
}

const calculateAWSAuthCost = (data: any) => {
  const { monthlyActiveUsers } = data
  const extraMAUs = Math.max(0, monthlyActiveUsers - 50000) * 0.0055
  return Math.round(extraMAUs * 100) / 100
}

const calculateStorageCost = (data: any) => {
  const { storageGB, downloadsGB } = data
  let cost = 0
  if (storageGB > 5) cost += (storageGB - 5) * 0.021
  cost += downloadsGB * 0.09
  return Math.round(cost * 100) / 100
}

const calculateFirebaseStorageCost = (data: any) => {
  const { storageGB, downloadsGB } = data
  const storageCost = storageGB * 0.026
  const downloadCost = downloadsGB * 0.12
  return Math.round((storageCost + downloadCost) * 100) / 100
}

const calculateAWSStorageCost = (data: any) => {
  const { storageGB, downloadsGB } = data
  const storageCost = storageGB * 0.023
  const egressCost = Math.max(0, downloadsGB - 100) * 0.09 // Refined: first 100GB free
  return Math.round((storageCost + egressCost) * 100) / 100
}

const calculateFunctionsCost = (data: any) => {
  const { invocationsPerMonth, averageDurationMs, memoryGB } = data
  const extraInvocations = Math.max(0, invocationsPerMonth - 500000) / 100000 * 0.125
  const gbSeconds = invocationsPerMonth * (averageDurationMs / 1000) * memoryGB
  const extraGBs = Math.max(0, gbSeconds - 100000) * 0.0000025
  return Math.round((extraInvocations + extraGBs) * 100) / 100
}

const calculateFirebaseFunctionsCost = (data: any) => {
  const { invocationsPerMonth, averageDurationMs, memoryGB } = data
  const invocationCost = (invocationsPerMonth / 1000000) * 0.40
  const gbSeconds = invocationsPerMonth * (averageDurationMs / 1000) * memoryGB
  const computeCost = gbSeconds * 0.0000025
  return Math.round((invocationCost + computeCost) * 100) / 100
}

const calculateAWSFunctionsCost = (data: any) => {
  const { invocationsPerMonth, averageDurationMs, memoryGB } = data
  const requestCost = (invocationsPerMonth / 1000000) * 0.20
  const gbSeconds = invocationsPerMonth * (averageDurationMs / 1000) * memoryGB
  const computeCost = gbSeconds * 0.00001667
  return Math.round((requestCost + computeCost) * 100) / 100
}

const calculateRealtimeCost = (data: any) => {
  const { concurrentConnections, messagesPerMonth } = data
  const extraConnections = Math.max(0, concurrentConnections - 500) / 1000 * 10
  const extraMessages = Math.max(0, messagesPerMonth - 5000000) / 1000000 * 2.5
  return Math.round((extraConnections + extraMessages) * 100) / 100
}

const calculateFirebaseRealtimeCost = (data: any) => {
  const { messagesPerMonth } = data
  // Approximate as 50% reads, 50% writes
  const reads = (messagesPerMonth * 0.5) / 100000 * 0.06
  const writes = (messagesPerMonth * 0.5) / 100000 * 0.18
  return Math.round((reads + writes) * 100) / 100
}

const calculateAWSRealtimeCost = (data: any) => {
  const { concurrentConnections, messagesPerMonth } = data
  const operationsCost = (messagesPerMonth / 1000000) * 4
  const connectionCost = concurrentConnections * 0.002 // Approx per concurrent/month
  return Math.round((operationsCost + connectionCost) * 100) / 100
} 

export default function EstimatesPage() {
  return (
    <Suspense fallback={<div>Loading estimates...</div>}>
      <EstimatesClientContent />
    </Suspense>
  )
}
