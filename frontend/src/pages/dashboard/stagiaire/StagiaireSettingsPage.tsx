
import { useState } from "react"
import {
  Save,
  Bell,
  Shield,
  User2,
  GraduationCap,
} from "lucide-react"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useStagiaireSidebar } from "@/hooks/use-stagiaire-sidebar"

export default function StagiaireSettingsPage() {
  const { navItems, userName, userRole } = useStagiaireSidebar()
  const [saved, setSaved] = useState(false)
  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000) }

  return (
    <DashboardShell role="stagiaire" navItems={navItems} userName={userName} userRole={userRole}>
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

        {/* Personal Info */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User2 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Informations personnelles</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">Nom</Label>
                <Input defaultValue="Ben Ahmed" className="text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">{"Pr\u00e9nom"}</Label>
                <Input defaultValue="Sarra" className="text-sm" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">Email</Label>
                <Input defaultValue="sarra.ba@email.com" type="email" className="text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">{"T\u00e9l\u00e9phone"}</Label>
                <Input defaultValue="+216 55 123 456" className="text-sm" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">CIN</Label>
              <Input defaultValue="12345678" className="text-sm max-w-[200px]" />
            </div>
          </CardContent>
        </Card>

        {/* Academic Info */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Informations academiques</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">Etablissement</Label>
                <Input defaultValue="ENSI - Ecole Nationale des Sciences de l'Informatique" className="text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">{"Sp\u00e9cialit\u00e9"}</Label>
                <Input defaultValue="Genie Logiciel" className="text-sm" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">Niveau</Label>
                <Input defaultValue="3eme annee" className="text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">{"Ann\u00e9e universitaire"}</Label>
                <Input defaultValue="2025/2026" className="text-sm" />
              </div>
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
              { id: "msgNotif", label: "Nouveaux messages", desc: "Notification pour les messages de votre encadrant", defaultChecked: true },
              { id: "deadlineNotif", label: "Rappels echeances", desc: "Alerte 3 jours avant chaque echeance", defaultChecked: true },
              { id: "evalNotif", label: "Evaluations", desc: "Notification des evaluations planifiees", defaultChecked: true },
              { id: "docNotif", label: "Documents valides", desc: "Notification quand un document est valide par l'encadrant", defaultChecked: false },
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
