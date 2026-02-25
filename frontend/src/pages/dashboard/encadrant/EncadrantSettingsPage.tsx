
import { useState } from "react"
import {
  LayoutDashboard,
  Users,
  Star,
  Calendar,
  MessageSquare,
  Settings,
  Save,
  Bell,
  Shield,
  User2,
} from "lucide-react"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useEncadrantSidebar } from "@/hooks/use-encadrant-sidebar"

export default function EncadrantSettingsPage() {
  const { navItems, userName, userRole } = useEncadrantSidebar()
  const [saved, setSaved] = useState(false)
  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000) }

  return (
    <DashboardShell role="encadrant" navItems={navItems} userName={userName} userRole={userRole}>
      <div className="flex flex-col gap-6 max-w-3xl">
        <DashboardPageHeader
          title={"Param\u00e8tres"}
          subtitle={"G\u00e9rer votre profil et pr\u00e9f\u00e9rences"}
          actions={(
            <Button onClick={handleSave} className="gap-1.5 text-sm">
              <Save className="h-4 w-4" />
              {saved ? "Enregistre !" : "Enregistrer"}
            </Button>
          )}
        />

        {/* Profile */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User2 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Profil</CardTitle>
            </div>
            <CardDescription>Vos informations personnelles</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">Nom complet</Label>
                <Input defaultValue="Dr. Leila Khelifi" className="text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">{"Sp\u00e9cialit\u00e9"}</Label>
                <Input defaultValue="Genie Logiciel" className="text-sm" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">Email</Label>
                <Input defaultValue="leila.k@cni.tn" type="email" className="text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">{"T\u00e9l\u00e9phone"}</Label>
                <Input defaultValue="+216 71 123 456" className="text-sm" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">{"D\u00e9partement"}</Label>
              <Input defaultValue="Direction du Developpement" className="text-sm" disabled />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">{"Capacit\u00e9 maximale de stagiaires"}</Label>
              <Input defaultValue="5" type="number" className="text-sm max-w-[100px]" />
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Notifications</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {[
              { id: "newStagiaire", label: "Nouveau stagiaire affecte", desc: "Notification lors d'une nouvelle affectation", defaultChecked: true },
              { id: "msgNotif", label: "Messages", desc: "Notification pour les nouveaux messages", defaultChecked: true },
              { id: "evalReminder", label: "Rappel evaluation", desc: "Rappel 3 jours avant une evaluation", defaultChecked: true },
              { id: "weeklyDigest", label: "Resume hebdomadaire", desc: "Rapport de progression chaque vendredi", defaultChecked: false },
            ].map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch id={item.id} defaultChecked={item.defaultChecked} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">{"S\u00e9curit\u00e9"}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">Nouveau mot de passe</Label>
                <Input type="password" placeholder="********" className="text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">Confirmer</Label>
                <Input type="password" placeholder="********" className="text-sm" />
              </div>
            </div>
            <Button variant="outline" size="sm" className="self-start text-xs">
              Changer le mot de passe
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}
