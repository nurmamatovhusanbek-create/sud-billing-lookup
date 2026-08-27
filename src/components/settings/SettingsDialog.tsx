'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RefreshCw, Settings as SettingsIcon } from 'lucide-react'
import { UpdatesTab } from './UpdatesTab'
import { WorkersTab } from './WorkersTab'
import { HealthTab } from './HealthTab'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<'updates' | 'workers' | 'health'>('updates')
  const [refreshKey, setRefreshKey] = useState(0)

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5" />
                Sozlamalar
              </DialogTitle>
              <DialogDescription className="mt-1">
                Yangilanishlar, worker'lar va holatni boshqaring
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Yangilash
            </Button>
          </div>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as any)}
          className="w-full"
        >
          <div className="px-6 pb-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="updates">Yangilanishlar</TabsTrigger>
              <TabsTrigger value="workers">Worker'lar</TabsTrigger>
              <TabsTrigger value="health">Holat</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="h-[60vh] px-6 pb-6">
            <TabsContent value="updates" className="mt-0">
              <UpdatesTab key={`updates-${refreshKey}`} />
            </TabsContent>
            <TabsContent value="workers" className="mt-0">
              <WorkersTab key={`workers-${refreshKey}`} />
            </TabsContent>
            <TabsContent value="health" className="mt-0">
              <HealthTab key={`health-${refreshKey}`} />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
